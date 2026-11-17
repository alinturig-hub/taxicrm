/** Non-secret connection settings. Saving settings does not enable a transport. */
export type EmailConnectionConfig =
 | { provider:'sendgrid'; senderEmail:string; senderName:string }
 | { provider:'smtp'; senderEmail:string; senderName:string; smtp:{host:string;port:number;security:'tls'|'starttls';username:string}; pop3:null|{host:string;port:number;security:'tls'|'starttls';username:string} };
const text=(v:unknown,max:number):v is string=>typeof v==='string' && v.length>0 && v.length<=max && v.trim()===v && !/[\x00-\x1f\x7f]/.test(v);
const fields=(v:unknown,keys:string[]):v is Record<string,unknown> => !!v && typeof v==='object' && !Array.isArray(v) && Object.keys(v).sort().join(',')===keys.sort().join(',');
function server(value:unknown):boolean {
 if(!fields(value,['host','port','security','username']))return false;
 // Network access needs additional DNS/IP checks at connection time; this is syntax validation only.
 return text(value.host,253) && /^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/.test(value.host) && Number.isInteger(value.port) && (value.port as number)>0 && (value.port as number)<=65535 && (value.security==='tls'||value.security==='starttls') && text(value.username,254);
}
export function validateEmailConnection(input:unknown): input is EmailConnectionConfig {
 if(!input || typeof input!=='object' || Array.isArray(input))return false;
 const v=input as Record<string,unknown>;
 if(!text(v.senderEmail,254) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.senderEmail) || !text(v.senderName,120))return false;
 if(v.provider==='sendgrid')return fields(v,['provider','senderEmail','senderName']);
 return v.provider==='smtp' && fields(v,['provider','senderEmail','senderName','smtp','pop3']) && server(v.smtp) && (v.pop3===null||server(v.pop3));
}
