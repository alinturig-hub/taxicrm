"""Disposable networkless PostgreSQL only; no application or live credentials."""
import subprocess,pathlib,concurrent.futures
base=['docker','--host=unix:///var/run/docker.sock','exec','-i','taxicrm-meta-inbox-synthetic','psql','-U','postgres','-v','ON_ERROR_STOP=1','-At']
def sql(s):
 p=subprocess.run(base,input=s,text=True,capture_output=True)
 if p.returncode:raise AssertionError(p.stderr)
 return p.stdout.strip()
sql(pathlib.Path('prisma/migrations/20261102000000_whatsapp_webhook_inbox/migration.sql').read_text())
def insert(i):
 return sql(f'''INSERT INTO "WhatsAppWebhookInbox"("id","connectionKey","bodyHash","rawBody") VALUES ('synthetic-{i}','META:123456789','synthetic-hash','{{"synthetic":true}}') ON CONFLICT ("connectionKey","bodyHash") DO NOTHING;''')
with concurrent.futures.ThreadPoolExecutor(4) as pool:list(pool.map(insert,range(8)))
assert sql('SELECT count(*) FROM "WhatsAppWebhookInbox";')=='1'
assert sql('SELECT "rawBody" FROM "WhatsAppWebhookInbox";')=='{"synthetic":true}'
sql('''INSERT INTO "WhatsAppWebhookInbox"("id","connectionKey","bodyHash","rawBody") VALUES ('other','META:987654321','synthetic-hash','{}');''')
assert sql('SELECT count(*) FROM "WhatsAppWebhookInbox";')=='2'
print('PASS: migration, eight simultaneous duplicate deliveries, exact raw body, scoped deduplication')
