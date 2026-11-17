import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {emailEligibility} from './eligibility';
const good={connectionEnabled:true,emailPermission:'granted' as const,suppressed:false,unsubscribeUrl:'https://example.test/unsubscribe',templateAvailable:true};
test('requires permission and unsubscribe for email marketing',()=>{
 assert.equal(emailEligibility(good),'ELIGIBLE');
 assert.equal(emailEligibility({...good,emailPermission:'unknown'}),'PERMISSION_REQUIRED');
 assert.equal(emailEligibility({...good,emailPermission:'denied'}),'PERMISSION_REQUIRED');
 assert.equal(emailEligibility({...good,suppressed:true}),'SUPPRESSED');
 assert.equal(emailEligibility({...good,unsubscribeUrl:'http://example.test'}),'UNSUBSCRIBE_REQUIRED');
 assert.equal(emailEligibility({...good,connectionEnabled:false}),'CONNECTION_DISABLED');
});
