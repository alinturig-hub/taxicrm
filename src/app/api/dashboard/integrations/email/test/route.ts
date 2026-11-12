import {NextResponse} from 'next/server';
import {prisma} from '@/lib/prisma';
import {emailAccess,sameOrigin} from '@/lib/integrations/email/access';
import {decryptSecret} from '@/lib/security/encryption';
import {checkSendGridKey} from '@/lib/integrations/email/sendgrid';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function POST(request:Request){
 if(!await emailAccess(true))return NextResponse.json({error:'FORBIDDEN'},{status:403,headers});
 if(!sameOrigin(request))return NextResponse.json({error:'ORIGIN_REQUIRED'},{status:403,headers});
 try{
  const connection=await prisma.marketingEmailConnection.findUnique({where:{id:'primary'},select:{provider:true,secretCiphertext:true}});
  if(!connection)return NextResponse.json({error:'NO_CONNECTION'},{status:404,headers});
  if(connection.provider!=='sendgrid')return NextResponse.json({error:'TEST_NOT_AVAILABLE'},{status:409,headers});
  const result=await checkSendGridKey(decryptSecret(connection.secretCiphertext));
  return NextResponse.json({result},{headers});
 }catch{return NextResponse.json({error:'CONNECTION_UNAVAILABLE'},{status:503,headers})}
}
