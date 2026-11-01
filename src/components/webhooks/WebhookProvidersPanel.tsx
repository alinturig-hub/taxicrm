import { publicProvider } from "@/lib/autocab/webhook-providers";
import { prisma } from "@/lib/prisma";
import WebhookWorkspace from "@/components/webhooks/WebhookWorkspace";
import { workspaceAccess } from "@/lib/workspace/access";
export default async function WebhookProvidersPanel({ providerId }: { providerId?: string }) {
  const { access } = await workspaceAccess();
  const configurations = await prisma.autocabWebhookConfiguration.findMany({
    where: providerId ? { providerId } : undefined,
    orderBy: [
      {
        isEnabled: "desc",
      },
      {
        displayName: "asc",
      },
    ],
    include: {
      conditions: {
        where: {
          isEnabled: true,
        },
        orderBy: {
          position: "asc",
        },
      },
      webhookEvents: {
        orderBy: {
          receivedAt: "desc",
        },
        take: 1,
        select: {
          receivedAt: true,
          status: true,
        },
      },
      _count: {
        select: {
          webhookEvents: true,
        },
      },
    },
  });

  const providers = await prisma.webhookProvider.findMany({
    where: providerId ? { id: providerId } : undefined,
    orderBy: { createdAt: "asc" },
  });
  return (
    <WebhookWorkspace
      scoped={Boolean(providerId)}
      canInspect={access.isSuperAdmin || access.permissions.includes("configuration.view")}
      canManage={
        access.isSuperAdmin ||
        access.permissions.includes("configuration.manage")
      }
      providers={providers.map((provider) =>
        publicProvider({
          ...provider,
          apiKeyHeader:
            provider.id === "autocab" && !provider.apiKeyEncrypted
              ? process.env.AUTOCAB_WEBHOOK_API_KEY_HEADER?.trim() ||
                provider.apiKeyHeader
              : provider.apiKeyHeader,
        }),
      )}
      events={configurations.map((configuration) => ({
        id: configuration.id,
        providerId: configuration.providerId,
        displayName: configuration.displayName,
        eventType: configuration.eventType,
        endpointSlug: configuration.endpointSlug,
        description: configuration.description,
        isEnabled: configuration.isEnabled,
        count: configuration._count.webhookEvents,
        conditions: configuration.conditions.length,
        lastReceived:
          configuration.webhookEvents[0]?.receivedAt.toISOString() ?? null,
        lastStatus: configuration.webhookEvents[0]?.status ?? null,
      }))}
    />
  );
}
