import { timingSafeEqual } from 'node:crypto';
import { NextRequest } from 'next/server';
export function auditAuthorized(request:NextRequest){
 const a=process.env.CRON_SECRET,b=request.headers.get('x-cron-secret');
 return !!a&&!!b&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
}
