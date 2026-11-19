import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { emailCampaignReadiness } from './readiness';
test('sending stays off unless every required control is configured',()=>{
 const {publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
 const env={EMAIL_CAMPAIGNS_ENABLED:'true',EMAIL_WORKER_SECRET:'w'.repeat(32),EMAIL_UNSUBSCRIBE_SECRET:'s'.repeat(32),SENDGRID_EVENT_PUBLIC_KEY:publicKey.export({format:'der',type:'spki'}).toString('base64'),NEXTAUTH_URL:'https://example.test'};
 assert.equal(emailCampaignReadiness(env),true);
 for(const field of Object.keys(env)) assert.equal(emailCampaignReadiness({...env,[field]:''}),false,field);
 assert.equal(emailCampaignReadiness({...env,NEXTAUTH_URL:'http://example.test'}),false);
});
