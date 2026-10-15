import { workspaceGroup } from "@/lib/workspace/access";
import ApiEndpointsManager from "@/components/configuration/ApiEndpointsManager";
export const dynamic = "force-dynamic";
export default async function AutocabApiPage() { await workspaceGroup("configuration"); return <ApiEndpointsManager />; }
