import subprocess,pathlib,concurrent.futures
base=['docker','--host=unix:///var/run/docker.sock','exec','-i','taxicrm-outbox-synthetic','psql','-U','postgres','-v','ON_ERROR_STOP=1','-At']
def sql(s,ok=True):
 p=subprocess.run(base,input=s,text=True,capture_output=True)
 if ok and p.returncode:raise AssertionError(p.stderr)
 return p
sql(pathlib.Path('prisma/migrations/20261103000000_whatsapp_outbound/migration.sql').read_text())
insert='''INSERT INTO "WhatsAppOutboundMessage"("id","connectionKey","operationKey","requestHash","actorUserId","recipient","templateSnapshot","purpose","eligibilityEvidence") VALUES ('synthetic-1','META:synthetic','op-1','hash-1','synthetic-operator','+447700900123','{}','SERVICE','{}') ON CONFLICT ("connectionKey","operationKey") DO NOTHING;'''
with concurrent.futures.ThreadPoolExecutor(4) as pool:list(pool.map(sql,[insert]*8))
assert sql('SELECT count(*) FROM "WhatsAppOutboundMessage";').stdout.strip()=='1'
claim='''UPDATE "WhatsAppOutboundMessage" SET "status"='SENDING',"attemptCount"=1,"claimedAt"=now() WHERE "id"='synthetic-1' AND "connectionKey"='META:synthetic' AND "status"='QUEUED' AND "attemptCount"=0 RETURNING "id";'''
with concurrent.futures.ThreadPoolExecutor(4) as pool:results=list(pool.map(sql,[claim]*8))
assert sum('synthetic-1' in p.stdout for p in results)==1
assert sql('SELECT "attemptCount" FROM "WhatsAppOutboundMessage";').stdout.strip()=='1'
assert sql('''UPDATE "WhatsAppOutboundMessage" SET "status"='ACCEPTED' WHERE "id"='synthetic-1';''',False).returncode!=0
sql('''UPDATE "WhatsAppOutboundMessage" SET "status"='UNKNOWN' WHERE "id"='synthetic-1';''')
assert 'synthetic-1' not in sql(claim).stdout
sql('''UPDATE "WhatsAppOutboundMessage" SET "status"='ACCEPTED',"providerMessageId"='wamid.synthetic' WHERE "id"='synthetic-1';''')
assert 'synthetic-1' not in sql(claim).stdout
print('PASS: migration, 8 concurrent enqueues, 8 competing claims/one winner, single attempt, accepted ID constraint, no requeue of UNKNOWN or ACCEPTED')
