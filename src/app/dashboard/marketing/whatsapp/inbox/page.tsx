import {whatsappAccess} from "@/lib/integrations/whatsapp/access";
import WhatsAppInbox from "@/components/marketing/WhatsAppInbox";
export const dynamic="force-dynamic";
export default async function Page(){await whatsappAccess();return <WhatsAppInbox/>;}
