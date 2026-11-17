import {lookup} from 'node:dns/promises';
import ipaddr from 'ipaddr.js';
/** Reject private, local and special-purpose addresses before connecting to a configured mail host. */
export async function publicMailAddress(host:string, resolve:typeof lookup=lookup):Promise<{address:string;family:4|6}> {
 const results=await resolve(host,{all:true,verbatim:true});
 if(!results.length)throw new Error('MAIL_HOST_UNAVAILABLE');
 for(const entry of results){const parsed=ipaddr.process(entry.address);if(parsed.range()!=='unicast')throw new Error('MAIL_HOST_NOT_PUBLIC')}
 const first=results[0];return {address:first.address,family:first.family as 4|6};
}
