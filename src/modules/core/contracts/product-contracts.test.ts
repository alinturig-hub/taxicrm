import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { sameSourceIdentity } from './source-data';
import { hasMarketingPermission } from './marketing-channels';
test('external identities are isolated by source and connection', () => {
 const a={kind:'autocab' as const,connectionId:'one',externalId:'7'};
 assert.equal(sameSourceIdentity(a,{...a}),true);
 assert.equal(sameSourceIdentity(a,{...a,connectionId:'two'}),false);
 assert.equal(sameSourceIdentity(a,{...a,kind:'needacabplus'}),false);
});
test('marketing permission must be affirmative and specific to the channel', () => {
 const permission={channel:'email' as const,purpose:'marketing' as const,status:'granted' as const,evidenceRef:null,recordedAt:null};
 assert.equal(hasMarketingPermission(permission,'email'),true);
 assert.equal(hasMarketingPermission(permission,'sms'),false);
 assert.equal(hasMarketingPermission({...permission,status:'unknown'},'email'),false);
 assert.equal(hasMarketingPermission({...permission,status:'denied'},'email'),false);
});
