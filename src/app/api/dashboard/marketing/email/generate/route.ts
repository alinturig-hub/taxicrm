import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { requireAdministrationPermission } from '@/lib/administration-access';
import { moduleApiBlock } from '@/modules/core/activation/access';
import { sameOrigin, body, privateHeaders } from '@/lib/ai/owner-agent/http';
import { AgentError, resolveAgentConfig } from '@/lib/ai/owner-agent/policy';
import { readProvider, connectionFromProvider } from '@/lib/ai/owner-agent/provider-store';
import { reserveQuestion } from '@/lib/ai/owner-agent/runtime';
import { generateEmail, localEmailModel, EmailGenerationError } from '@/lib/marketing/email/generate';
export const dynamic='force-dynamic';export const runtime='nodejs';
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:privateHeaders});
export async function POST(request:Request) {
 let release:(()=>void)|undefined;
 try {
  const session=await getServerSession(authOptions);const access=session?.user?.email?await requireAdministrationPermission(session.user.email,'customers.manage'):null;
  if(!access)return json({error:'FORBIDDEN'},403);sameOrigin(request);
  const blocked=await moduleApiBlock('ai');if(blocked)return blocked;
  const input=await body(request);if(Object.keys(input).join(',')!=='prompt'||typeof input.prompt!=='string'||!input.prompt.trim()||input.prompt.length>2000)throw new EmailGenerationError('INVALID_PROMPT',400);
  let connection=localEmailModel();
  if(!connection){const config=resolveAgentConfig();connection=connectionFromProvider(await readProvider(config))||null;}
  if(!connection)throw new EmailGenerationError('MODEL_NOT_CONFIGURED');
  release=reserveQuestion('email-template-generator',access.user.id);
  return json(await generateEmail(input.prompt,connection));
 }catch(e){if(e instanceof AgentError||e instanceof EmailGenerationError)return json({error:e.code},e.status);return json({error:'GENERATION_UNAVAILABLE'},503);}finally{release?.();}
}
