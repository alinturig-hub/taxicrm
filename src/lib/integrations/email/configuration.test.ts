import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {validateEmailConnection} from './configuration';
const base={provider:'smtp',senderEmail:'team@example.com',senderName:'Taxi',smtp:{host:'smtp.example.com',port:587,security:'starttls',username:'team'},pop3:null};
test('accepts SMTP and optional POP3 configuration without secrets',()=>{
 assert(validateEmailConnection(base));
 assert(validateEmailConnection({...base,pop3:{host:'pop.example.com',port:995,security:'tls',username:'team'}}));
 assert(validateEmailConnection({provider:'sendgrid',senderEmail:'team@example.com',senderName:'Taxi'}));
});
test('rejects non-TLS, embedded secrets and invalid ports or addresses',()=>{
 assert(!validateEmailConnection({...base,smtp:{...base.smtp,security:'plain'}}));
 assert(!validateEmailConnection({...base,smtp:{...base.smtp,password:'secret'}}));
 assert(!validateEmailConnection({...base,smtp:{...base.smtp,port:0}}));
 assert(!validateEmailConnection({...base,senderEmail:'team@example.com\nBcc:bad@example.com'}));
});
