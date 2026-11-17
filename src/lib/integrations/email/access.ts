import {getServerSession} from 'next-auth';
import {authOptions} from '@/lib/auth';
import {requireAdministrationPermission} from '@/lib/administration-access';
export async function emailAccess(write:boolean) {
 const session=await getServerSession(authOptions);
 return requireAdministrationPermission(session?.user?.email,write?'configuration.manage':'configuration.view');
}
export function sameOrigin(request:Request):boolean {
 const origin=request.headers.get('origin');
 try{return !!origin && origin===new URL(process.env.NEXTAUTH_URL || request.url).origin}catch{return false}
}
