import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { workspaceAccess } from "@/lib/workspace/access";
import WebhookEditor from "@/components/webhooks/WebhookEditor";
export const dynamic = "force-dynamic";
export default async function WebhookPage({
  params,
}: {
  params: { id: string };
}) {
  const { access } = await workspaceAccess();
  if (
    !access.isSuperAdmin &&
    !access.permissions.includes("configuration.view")
  )
    redirect("/dashboard");
  const configuration = await prisma.autocabWebhookConfiguration.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      displayName: true,
      description: true,
      isEnabled: true,
      eventType: true,
      endpointSlug: true,
      processingMode: true,
      conditionMode: true,
      conditions: {
        orderBy: { position: "asc" },
        select: { id: true, fieldPath: true, operator: true },
      },
      webhookProvider: { select: { baseUrl: true } },
    },
  });
  if (!configuration) notFound();
  return (
    <WebhookEditor
      configuration={configuration}
      baseUrl={configuration.webhookProvider.baseUrl}
      canManage={
        access.isSuperAdmin ||
        access.permissions.includes("configuration.manage")
      }
    />
  );
}
