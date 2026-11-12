import {NextResponse} from 'next/server';
import {prisma} from '@/lib/prisma';
import {emailAccess,sameOrigin} from '@/lib/integrations/email/access';
import {validateEmailConnection} from '@/lib/integrations/email/configuration';
import {encryptSecret} from '@/lib/security/encryption';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
const safe={provider:true,config:true,updatedAt:true} as const;
export async function GET(){
 if(!await emailAccess(false))return NextResponse.json({error:'FORBIDDEN'},{status:403,headers});
 try{return NextResponse.json({connection:await prisma.marketingEmailConnection.findUnique({where:{id:'primary'},select:safe})},{headers})}catch{return NextResponse.json({error:'STORAGE_UNAVAILABLE'},{status:503,headers})}
}
export async function PUT(request:Request){
 if(!await emailAccess(true))return NextResponse.json({error:'FORBIDDEN'},{status:403,headers});
 if(!sameOrigin(request))return NextResponse.json({error:'ORIGIN_REQUIRED'},{status:403,headers});
 try{
  const text=await request.text();if(Buffer.byteLength(text)>8192)return NextResponse.json({error:'INVALID_INPUT'},{status:400,headers});
  const body=JSON.parse(text);
  if(!body||Object.keys(body).sort().join(',')!=='config,pop3Secret,secret'||!validateEmailConnection(body.config)||typeof body.secret!=='string'||!body.secret||body.secret.length>512||typeof body.pop3Secret!=='string'||body.pop3Secret.length>512||(body.config.provider==='smtp'&&body.config.pop3&&!body.pop3Secret))return NextResponse.json({error:'INVALID_INPUT'},{status:400,headers});
  const data={provider:body.config.provider,config:body.config,secretCiphertext:encryptSecret(body.secret),pop3SecretCiphertext:body.config.provider==='smtp'&&body.config.pop3?encryptSecret(body.pop3Secret):null};
  const connection=await prisma.marketingEmailConnection.upsert({where:{id:'primary'},create:{id:'primary',...data},update:data,select:safe});
  return NextResponse.json({connection},{headers});
 }catch(error){if(error instanceof SyntaxError)return NextResponse.json({error:'INVALID_INPUT'},{status:400,headers});return NextResponse.json({error:'STORAGE_UNAVAILABLE'},{status:503,headers})}
}
