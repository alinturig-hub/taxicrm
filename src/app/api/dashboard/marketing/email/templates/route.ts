import {NextResponse} from 'next/server';
import {prisma} from '@/lib/prisma';
import {emailAccess,sameOrigin} from '@/lib/integrations/email/access';
import {validateEmailDraft} from '@/lib/integrations/email/template';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function GET(){
 if(!await emailAccess(false))return NextResponse.json({error:'FORBIDDEN'},{status:403,headers});
 try{return NextResponse.json({templates:await prisma.marketingEmailTemplate.findMany({orderBy:{updatedAt:'desc'},take:100})},{headers})}catch{return NextResponse.json({error:'STORAGE_UNAVAILABLE'},{status:503,headers})}
}
export async function POST(request:Request){
 if(!await emailAccess(true))return NextResponse.json({error:'FORBIDDEN'},{status:403,headers});
 if(!sameOrigin(request))return NextResponse.json({error:'ORIGIN_REQUIRED'},{status:403,headers});
 try{
  const text=await request.text();if(Buffer.byteLength(text)>25000)throw Error('too large');
  const parsed=validateEmailDraft(JSON.parse(text));if(!parsed.ok)return NextResponse.json({error:parsed.error},{status:400,headers});
  const template=await prisma.marketingEmailTemplate.create({data:parsed.draft});return NextResponse.json({template},{status:201,headers});
 }catch(error){if(error instanceof SyntaxError)return NextResponse.json({error:'INVALID_INPUT'},{status:400,headers});return NextResponse.json({error:'STORAGE_UNAVAILABLE'},{status:503,headers})}
}
export async function PUT(request:Request){
 if(!await emailAccess(true))return NextResponse.json({error:'FORBIDDEN'},{status:403,headers});
 if(!sameOrigin(request))return NextResponse.json({error:'ORIGIN_REQUIRED'},{status:403,headers});
 try{
  const text=await request.text();if(Buffer.byteLength(text)>25000)throw Error('too large');
  const value=JSON.parse(text);if(!value||typeof value.id!=='string'||value.id.length>128||!Number.isSafeInteger(value.revision)||value.revision<1||Object.keys(value).sort().join(',')!=='body,id,name,revision,subject')return NextResponse.json({error:'INVALID_INPUT'},{status:400,headers});
  const parsed=validateEmailDraft({name:value.name,subject:value.subject,body:value.body});if(!parsed.ok)return NextResponse.json({error:parsed.error},{status:400,headers});
  const result=await prisma.marketingEmailTemplate.updateMany({where:{id:value.id,revision:value.revision},data:{...parsed.draft,revision:{increment:1}}});
  if(result.count!==1)return NextResponse.json({error:'TEMPLATE_CONFLICT'},{status:409,headers});
  return NextResponse.json({template:await prisma.marketingEmailTemplate.findUnique({where:{id:value.id}})},{headers});
 }catch(error){if(error instanceof SyntaxError)return NextResponse.json({error:'INVALID_INPUT'},{status:400,headers});return NextResponse.json({error:'STORAGE_UNAVAILABLE'},{status:503,headers})}
}
