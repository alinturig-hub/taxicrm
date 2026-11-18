import { createPublicKey } from 'node:crypto';
export function emailCampaignReadiness(env:NodeJS.ProcessEnv=process.env):boolean {
 try {
  const publicKey=env.SENDGRID_EVENT_PUBLIC_KEY||'';
  const key=publicKey.includes('BEGIN PUBLIC KEY')?createPublicKey(publicKey):createPublicKey({key:Buffer.from(publicKey,'base64'),format:'der',type:'spki'});
  const url=new URL(env.NEXTAUTH_URL||'');
  return env.EMAIL_CAMPAIGNS_ENABLED==='true' && (env.EMAIL_WORKER_SECRET||'').length>=32 && Buffer.byteLength(env.EMAIL_UNSUBSCRIBE_SECRET||'','utf8')>=32 && key.asymmetricKeyType==='ec' && url.protocol==='https:' && !url.username && !url.password;
 }catch{return false;}
}
export function eventPublicKey(value:string) {return value.includes('BEGIN PUBLIC KEY')?createPublicKey(value):createPublicKey({key:Buffer.from(value,'base64'),format:'der',type:'spki'});}
