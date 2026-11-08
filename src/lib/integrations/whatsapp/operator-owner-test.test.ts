import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ownerTestGuard} from './operator-owner-test';
const now=Date.now(),recipient='+447700900123';
const valid={NODE_ENV:'test' as const,WHATSAPP_OPERATOR_OWNER_TEST_MODE:'true',WHATSAPP_OPERATOR_OWNER_TEST_RECIPIENT:recipient,WHATSAPP_OPERATOR_OWNER_TEST_ID:'synthetic-test-id-00001',WHATSAPP_OPERATOR_OWNER_TEST_BODY_SHA256:'f66ea4ae0b8ba44ec51ce35535bb5f4f16962131cb84913a5a7ec5c22fc7a4ef',WHATSAPP_OPERATOR_OWNER_TEST_EXPIRES_AT:new Date(now+60000).toISOString(),WHATSAPP_JOURNEY_SENDING_ENABLED:'false',META_WHATSAPP_TEST_SEND_ENABLED:'false'};
test('owner test fails closed for missing, malformed, expired, non-allowed and broad sender configuration',()=>{
 assert.throws(()=>ownerTestGuard({NODE_ENV:'test'},recipient,'reply',now),/OWNER_TEST_CONFIGURATION_INVALID/);
 assert.throws(()=>ownerTestGuard({...valid,WHATSAPP_OPERATOR_OWNER_TEST_MODE:'invalid'},recipient,'reply',now),/OWNER_TEST_CONFIGURATION_INVALID/);
 assert.throws(()=>ownerTestGuard({...valid,WHATSAPP_OPERATOR_OWNER_TEST_BODY_SHA256:''},recipient,'takeover',now),/OWNER_TEST_CONFIGURATION_INVALID/);
 assert.throws(()=>ownerTestGuard(valid,'+447700900999','reply',now),/OWNER_TEST_RECIPIENT_NOT_ALLOWED/);
 assert.throws(()=>ownerTestGuard({...valid,WHATSAPP_OPERATOR_OWNER_TEST_EXPIRES_AT:new Date(now-1).toISOString()},recipient,'reply',now),/OWNER_TEST_EXPIRED/);
 assert.throws(()=>ownerTestGuard({...valid,WHATSAPP_OPERATOR_OWNER_TEST_EXPIRES_AT:new Date(now+86400001).toISOString()},recipient,'takeover',now),/OWNER_TEST_EXPIRED/);
 assert.throws(()=>ownerTestGuard({...valid,WHATSAPP_JOURNEY_SENDING_ENABLED:'true'},recipient,'reply',now),/OWNER_TEST_OTHER_SENDERS_NOT_DISABLED/);
 assert.equal(ownerTestGuard({...valid,WHATSAPP_OPERATOR_OWNER_TEST_MODE:'false'},recipient,'reply',now),null);
 assert.equal(ownerTestGuard(valid,recipient,'reply',now)?.operationKey,'operator-owner-test:synthetic-test-id-00001');
});
test('an allowed conversation can be released after expiry or after sending is disabled',()=>{
 const expired={...valid,WHATSAPP_OPERATOR_OWNER_TEST_EXPIRES_AT:new Date(now-1).toISOString(),WHATSAPP_JOURNEY_SENDING_ENABLED:'true'};
 assert.ok(ownerTestGuard(expired,recipient,'release',now));assert.throws(()=>ownerTestGuard(expired,'+447700900999','release',now),/OWNER_TEST_RECIPIENT_NOT_ALLOWED/);
});
