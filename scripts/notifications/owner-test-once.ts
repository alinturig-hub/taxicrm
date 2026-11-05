/** Manual internal runner. Does nothing unless --execute and exact owner-approved packet gates pass.
 * Never mount this as a web route, worker, scheduled retry or general notification transport.
 */
import {readFileSync} from 'node:fs';
import {Pool} from 'pg';
import {packetHash,runOwnerOneShot,type OwnerPacket} from '../../src/lib/integrations/whatsapp/owner-one-shot';
async function main(){
 const args=process.argv.slice(2),path=args.find(a=>!a.startsWith('--'));if(!path||args.some(a=>a.startsWith('--')&&!['--execute','--inspect'].includes(a)))throw Error('OWNER_PACKET_FILE_REQUIRED');
 const packet=JSON.parse(readFileSync(path,'utf8')) as OwnerPacket;
 if(!args.includes('--execute')){console.log(JSON.stringify({state:'BLOCKED_PENDING_EXPLICIT_EXECUTION_APPROVAL',approvalHash:packetHash(packet),expiresAt:packet.expiresAt,maximumProviderPosts:1,automaticRetries:0,smsFallback:false}));return;}
 // Pool construction alone does not connect; the library checks approval before acquiring a client.
 const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1,application_name:'taxicrm-owner-approved-one-shot',connectionTimeoutMillis:8000,statement_timeout:10000,query_timeout:12000,options:'-c lock_timeout=8000'});
 try{console.log(JSON.stringify(await runOwnerOneShot(packet,pool)));}finally{await pool.end();}
}
void main().catch(()=>{console.error('Owner test stopped. No automatic retry is permitted; inspect the durable operation before any further action.');process.exitCode=1;});
