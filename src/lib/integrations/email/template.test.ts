import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {validateEmailDraft,previewEmailText} from './template';
test('accepts supported variables and previews as plain text',()=>{
 assert.equal(validateEmailDraft({name:'Welcome',subject:'Hello {{customer_name}}',body:'Contact {{company_name}}'}).ok,true);
 assert.equal(previewEmailText('Hello {{customer_name}}',{customer_name:'<script>alert(1)</script>'}),'Hello <script>alert(1)</script>');
});
test('rejects unsupported variables, malformed variables and subject line breaks',()=>{
 for(const draft of [{name:'A',subject:'Hello {{secret}}',body:'ok'},{name:'A',subject:'ok',body:'{{broken'},{name:'A',subject:'one\ntwo',body:'ok'}]) assert.equal(validateEmailDraft(draft).ok,false);
});
