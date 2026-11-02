import {redirect} from "next/navigation";
import {workspaceAccess} from "@/lib/workspace/access";
import WhatsAppInbox from "@/components/marketing/WhatsAppInbox";
export const dynamic="force-dynamic";
export default async function Page(){
 const {access}=await workspaceAccess();
 if(!["configuration.view","integrations.view"].every(p=>access.permissions.includes(p as typeof access.permissions[number])))redirect("/dashboard/workspace");
 return <WhatsAppInbox/>;
}
