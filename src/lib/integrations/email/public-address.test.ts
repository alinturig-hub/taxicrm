import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {publicMailAddress} from './public-address';
const fake=(values:{address:string;family:number}[])=> (async()=>values) as never;
test('rejects private, loopback and mixed DNS responses',async()=>{
 for(const addr of ['127.0.0.1','10.1.2.3','169.254.169.254','::1','::ffff:127.0.0.1'])await assert.rejects(()=>publicMailAddress('mail.example.test',fake([{address:addr,family:addr.includes(':')?6:4}])));
 await assert.rejects(()=>publicMailAddress('mail.example.test',fake([{address:'8.8.8.8',family:4},{address:'10.0.0.1',family:4}])));
});
test('pins a public resolved address',async()=>{assert.deepEqual(await publicMailAddress('mail.example.test',fake([{address:'8.8.8.8',family:4}])),{address:'8.8.8.8',family:4})});
