import { test } from 'node:test';import assert from 'node:assert/strict';import {testConfig} from './owner-test';
test('owner test requires an explicit recipient, nonce, time limit and disabled general sending',()=>{
 const env={EMAIL_OWNER_TEST_ENABLED:'true',EMAIL_OWNER_TEST_RECIPIENT:'Owner@Example.test',EMAIL_OWNER_TEST_NONCE:'n'.repeat(40),EMAIL_OWNER_TEST_EXPIRES_AT:new Date(Date.now()+3600000).toISOString()};
 const valid=testConfig(env);assert.equal(valid.enabled,true);assert.equal(valid.recipient,'owner@example.test');assert.equal(valid.globalEnabled,false);
 for(const key of Object.keys(env))assert.equal(testConfig({...env,[key]:''}).enabled,false,key);
 assert.equal(testConfig({...env,EMAIL_OWNER_TEST_EXPIRES_AT:new Date(Date.now()-1000).toISOString()}).enabled,false);
 assert.equal(testConfig({...env,EMAIL_OWNER_TEST_EXPIRES_AT:new Date(Date.now()+25*3600000).toISOString()}).enabled,false);
 assert.equal(testConfig({...env,EMAIL_CAMPAIGNS_ENABLED:'true'}).globalEnabled,true);
});
