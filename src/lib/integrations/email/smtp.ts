import nodemailer from 'nodemailer';
import {publicMailAddress} from './public-address';
import type {EmailConnectionConfig} from './configuration';

type Smtp = Extract<EmailConnectionConfig,{provider:'smtp'}>;
/** No retries: an error after SMTP DATA may have an unknown outcome. */
export async function sendSmtpMessage(input:{config:Smtp;password:string;recipient:string;subject:string;body:string}) {
 if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(input.recipient)||/[\r\n]/.test(input.subject)||!input.subject||!input.body)throw Error('INVALID_MESSAGE');
 const address=await publicMailAddress(input.config.smtp.host);
 const transport=nodemailer.createTransport({host:address.address,port:input.config.smtp.port,secure:input.config.smtp.security==='tls',requireTLS:input.config.smtp.security==='starttls',tls:{servername:input.config.smtp.host,rejectUnauthorized:true},auth:{user:input.config.smtp.username,pass:input.password},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000});
 try {const result=await transport.sendMail({from:{name:input.config.senderName,address:input.config.senderEmail},to:input.recipient,subject:input.subject,text:input.body});return {state:'accepted' as const,providerMessageId:result.messageId};}
 catch {return {state:'unknown' as const,providerMessageId:null};}
 finally {transport.close()}
}
