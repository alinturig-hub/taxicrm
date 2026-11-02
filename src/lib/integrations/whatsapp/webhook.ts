import {createHmac,timingSafeEqual} from "node:crypto";
export function verifyMetaChallenge(params:URLSearchParams,verifyToken:string|undefined){
 if(!verifyToken||verifyToken.length<32)throw Error("WEBHOOK_NOT_CONFIGURED");
 const token=params.get("hub.verify_token")||"",challenge=params.get("hub.challenge")||"";
 const a=Buffer.from(token),b=Buffer.from(verifyToken);
 if(params.get("hub.mode")!=="subscribe"||a.length!==b.length||!timingSafeEqual(a,b)||!/^\d{1,64}$/.test(challenge))throw Error("VERIFICATION_FAILED");
 return challenge;
}
export function verifyMetaSignature(raw:Uint8Array,signature:string|null,appSecret:string|undefined){
 if(!appSecret||appSecret.length<16)throw Error("WEBHOOK_NOT_CONFIGURED");
 if(!signature||!/^sha256=[a-f0-9]{64}$/.test(signature))return false;
 const expected=createHmac("sha256",appSecret).update(raw).digest();
 return timingSafeEqual(expected,Buffer.from(signature.slice(7),"hex"));
}
