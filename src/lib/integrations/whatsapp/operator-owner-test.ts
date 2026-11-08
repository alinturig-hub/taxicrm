/** Optional one-recipient, one-attempt owner test. Disabled unless explicitly set to true. */
export function ownerTestGuard(env:NodeJS.ProcessEnv,participant:unknown,action:'takeover'|'release'|'reply',now=Date.now()){
 const mode=env.WHATSAPP_OPERATOR_OWNER_TEST_MODE;
 if(mode==='false')return null;
 if(mode!=='true')throw Error('OWNER_TEST_CONFIGURATION_INVALID');
 const approvedBodySha256=env.WHATSAPP_OPERATOR_OWNER_TEST_BODY_SHA256||'';
 const recipient=env.WHATSAPP_OPERATOR_OWNER_TEST_RECIPIENT||'',id=env.WHATSAPP_OPERATOR_OWNER_TEST_ID||'',expiryText=env.WHATSAPP_OPERATOR_OWNER_TEST_EXPIRES_AT||'',expires=Date.parse(expiryText);
 if(!/^\+[1-9]\d{7,14}$/.test(recipient)||!/^[a-zA-Z0-9_-]{16,80}$/.test(id)||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(expiryText)||!Number.isFinite(expires)||new Date(expires).toISOString()!==expiryText)throw Error('OWNER_TEST_CONFIGURATION_INVALID');
 if(participant!==recipient)throw Error('OWNER_TEST_RECIPIENT_NOT_ALLOWED');
 // Release stays possible after expiry or after other send paths are disabled.
 if(action!=='release'){
  if(!/^[a-f0-9]{64}$/.test(approvedBodySha256))throw Error('OWNER_TEST_CONFIGURATION_INVALID');
  if(expires-now<=8000||expires-now>24*60*60*1000)throw Error('OWNER_TEST_EXPIRED');
  if(env.WHATSAPP_JOURNEY_SENDING_ENABLED!=='false'||env.META_WHATSAPP_TEST_SEND_ENABLED!=='false')throw Error('OWNER_TEST_OTHER_SENDERS_NOT_DISABLED');
 }
 return {operationKey:`operator-owner-test:${id}`,expiresAt:expires,approvedBodySha256};
}
