import {Pool} from 'pg';
import {operatorReply} from '../../src/lib/integrations/whatsapp/operator-reply';
async function main(){
 const url=process.env.WHATSAPP_TEST_DATABASE_URL||'',schema=process.env.WHATSAPP_TEST_SCHEMA||'',expiry=process.env.WHATSAPP_TEST_EXPIRY||'',u=new URL(url);
 if(u.hostname!=='127.0.0.1'||u.port!=='55439'||u.username!=='whatsapp_qa'||!/^wa_[a-f0-9]{32}$/.test(schema))throw Error('ISOLATED_DATABASE_REQUIRED');
 const pool=new Pool({connectionString:url,options:`-c search_path=${schema}`});let calls=0;
 const env={NODE_ENV:'test' as const,WHATSAPP_OPERATOR_REPLY_ENABLED:'true',META_WHATSAPP_SENDING_ENABLED:'true',WHATSAPP_OPERATOR_OWNER_TEST_MODE:'true',WHATSAPP_OPERATOR_OWNER_TEST_RECIPIENT:'+447700900123',WHATSAPP_OPERATOR_OWNER_TEST_ID:'synthetic-owner-test-001',WHATSAPP_OPERATOR_OWNER_TEST_BODY_SHA256:'f66ea4ae0b8ba44ec51ce35535bb5f4f16962131cb84913a5a7ec5c22fc7a4ef',WHATSAPP_OPERATOR_OWNER_TEST_EXPIRES_AT:expiry,WHATSAPP_JOURNEY_SENDING_ENABLED:'false',META_WHATSAPP_TEST_SEND_ENABLED:'false'};
 try{const result=await operatorReply('conversation-1',{command_id:'synthetic-restart-command',revision:1,text:'Synthetic reply'},{pool,scope:'fleet:META:123456:789012',env,fetcher:(async()=>{calls++;throw Error('PROVIDER_MUST_NOT_BE_CALLED')}) as typeof fetch});if(result.status!==(process.env.WHATSAPP_TEST_EXPECT||'ACCEPTED')||calls!==0)throw Error('DURABLE_DEDUP_FAILED')}finally{await pool.end()}
}
main().catch(()=>{console.error('SYNTHETIC_RESTART_CHECK_FAILED');process.exitCode=1});
