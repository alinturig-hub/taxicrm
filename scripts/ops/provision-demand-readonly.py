#!/usr/bin/env python3
"""Provision only the dedicated demand-analysis login. Run on the DB host as root."""
import base64, hashlib, hmac, os, pwd, secrets, subprocess, sys

account = pwd.getpwnam('codex-audit')
path = os.path.join(account.pw_dir, '.pgpass')
password = secrets.token_urlsafe(36)
salt = secrets.token_bytes(16)
salted = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 4096)
client = hmac.new(salted, b'Client Key', hashlib.sha256).digest()
stored = hashlib.sha256(client).digest()
server = hmac.new(salted, b'Server Key', hashlib.sha256).digest()
b64 = lambda data: base64.b64encode(data).decode('ascii')
verifier = f'SCRAM-SHA-256$4096:{b64(salt)}${b64(stored)}:{b64(server)}'
line = f'10.0.1.34:5432:postgres:codex_demand_ro:{password}\n'

sql = f'''BEGIN;
DO $$ BEGIN
 IF current_database() <> 'postgres' OR to_regclass('public."Booking"') IS NULL THEN
  RAISE EXCEPTION 'Unexpected database';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='codex_demand_ro') THEN
  RAISE EXCEPTION 'Role already exists';
 END IF;
 IF EXISTS (
  SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace,
   LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a
  WHERE n.nspname NOT IN ('pg_catalog','information_schema')
   AND n.nspname NOT LIKE 'pg_toast%' AND c.relkind IN ('r','p','v','m','f')
   AND a.grantee=0 AND a.privilege_type IN ('SELECT','INSERT','UPDATE','DELETE','TRUNCATE')
 ) THEN RAISE EXCEPTION 'PUBLIC has relation privileges that require review'; END IF;
 IF EXISTS (
  SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace,
   LATERAL aclexplode(COALESCE(c.relacl, acldefault('S', c.relowner))) a
  WHERE n.nspname NOT IN ('pg_catalog','information_schema')
   AND n.nspname NOT LIKE 'pg_toast%' AND c.relkind='S'
   AND a.grantee=0 AND a.privilege_type IN ('USAGE','UPDATE')
 ) THEN RAISE EXCEPTION 'PUBLIC can modify sequence state'; END IF;
 IF EXISTS (
  SELECT 1 FROM pg_namespace n,
   LATERAL aclexplode(COALESCE(n.nspacl, acldefault('n', n.nspowner))) a
  WHERE n.nspname NOT IN ('pg_catalog','information_schema')
   AND n.nspname NOT LIKE 'pg_toast%' AND a.grantee=0 AND a.privilege_type='CREATE'
 ) THEN RAISE EXCEPTION 'PUBLIC can create objects in a schema'; END IF;
 IF EXISTS (
  SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace,
   LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
  WHERE n.nspname NOT IN ('pg_catalog','information_schema')
   AND n.nspname NOT LIKE 'pg_toast%' AND p.prosecdef
   AND a.grantee=0 AND a.privilege_type='EXECUTE'
 ) THEN RAISE EXCEPTION 'PUBLIC can execute security-definer function'; END IF;
END $$;
CREATE ROLE codex_demand_ro LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT PASSWORD '{verifier}';
ALTER ROLE codex_demand_ro SET default_transaction_read_only = on;
ALTER ROLE codex_demand_ro SET statement_timeout = '15s';
GRANT CONNECT ON DATABASE postgres TO codex_demand_ro;
GRANT USAGE ON SCHEMA public TO codex_demand_ro;
GRANT SELECT (id, provider, status, "pickupDueTime", "bookedAtTime", "createdAt", "updatedAt") ON public."Booking" TO codex_demand_ro;
GRANT SELECT ("bookingId", type, "zoneId", "createdAt", "updatedAt") ON public."BookingLocation" TO codex_demand_ro;
GRANT SELECT ("bookingId", "eventType", "createdAt") ON public."BookingSnapshot" TO codex_demand_ro;
GRANT SELECT ("bookingId", "eventType", "receivedAt", "processedAt", status) ON public."WebhookEvent" TO codex_demand_ro;
GRANT SELECT (id, "forecastKey", "modelVersion", "horizonHours", "issuedAt", "windowStartAt", "windowEndAt", "predictedCount", "actualCount", "lowerBound", "upperBound", status) ON public."BookingDemandForecast" TO codex_demand_ro;
GRANT SELECT (provider, "externalId", name, active) ON public."Zone" TO codex_demand_ro;
DO $$ BEGIN
 IF has_column_privilege('codex_demand_ro','public."Booking"','customerName','SELECT')
 OR has_column_privilege('codex_demand_ro','public."Booking"','telephoneNumber','SELECT')
 OR has_column_privilege('codex_demand_ro','public."Booking"','customerEmail','SELECT')
 OR has_column_privilege('codex_demand_ro','public."BookingSnapshot"','snapshot','SELECT')
 OR has_column_privilege('codex_demand_ro','public."WebhookEvent"','payload','SELECT') THEN
  RAISE EXCEPTION 'Unexpected access to sensitive columns';
 END IF;
END $$;
COMMIT;
'''
try:
 fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
except FileExistsError:
 sys.exit('STOP: .pgpass already exists; nothing changed.')
try:
 with os.fdopen(fd, 'w') as f:
  os.fchown(f.fileno(), account.pw_uid, account.pw_gid)
  f.write(line)
 result = subprocess.run(['docker','exec','-i','q9fahphg3lydu18inysgmerq','sh','-lc','exec psql -X -U "${POSTGRES_USER:-postgres}" -d postgres -v ON_ERROR_STOP=1'],input=sql,text=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
 if result.returncode:
  os.unlink(path)
  print('STOP: database transaction failed; .pgpass removed. No password was displayed.')
  sys.exit(1)
 print('Dedicated analysis role and protected credential created.')
except Exception:
 try: os.unlink(path)
 except OSError: pass
 raise
