import { workspaceGroup } from "@/lib/workspace/access";
import EventsPage from "@/app/dashboard/configuration/webhooks/events/page";
export const dynamic = "force-dynamic";
export default async function AutocabActivityPage() { await workspaceGroup("configuration"); return <EventsPage />; }
