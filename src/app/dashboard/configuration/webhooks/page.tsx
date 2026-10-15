import WebhookProvidersPanel from "@/components/webhooks/WebhookProvidersPanel";
import { workspaceGroup } from "@/lib/workspace/access";
export const dynamic = "force-dynamic";
export default async function WebhooksPage() { await workspaceGroup("configuration"); return <WebhookProvidersPanel />; }
