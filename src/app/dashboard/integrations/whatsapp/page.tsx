import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { requireAdministrationPermission } from "@/lib/administration-access";
import WhatsAppSettings from "./settings";
export const dynamic = "force-dynamic";
export default async function Page() {
  const session = await getServerSession(authOptions);
  if (!await requireAdministrationPermission(session?.user?.email, "integrations.manage")) redirect("/dashboard");
  return <WhatsAppSettings />;
}
