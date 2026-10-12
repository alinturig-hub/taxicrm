import { prisma } from "@/lib/prisma";
export async function enabledIntegrationCounts() {
  const [webhookSources, webhookEvents, apiEndpoints, autocab, geoapify, sms] =
    await Promise.all([
      prisma.webhookProvider.count({ where: { isEnabled: true } }),
      prisma.autocabWebhookConfiguration.count({ where: { isEnabled: true } }),
      prisma.apiEndpointConfiguration.count({ where: { isEnabled: true } }),
      prisma.autocabApiConfiguration.count({
        where: { OR: [{ isEnabled: true }, { driverSyncEnabled: true }] },
      }),
      prisma.geoapifyApiConfiguration.count({ where: { isEnabled: true } }),
      prisma.smsGatewayConfiguration.count({ where: { isEnabled: true } }),
    ]);
  return {
    webhookSources,
    webhookEvents,
    apiEndpoints,
    autocab,
    geoapify,
    sms,
  };
}
export async function disableExistingIntegrations(actorUserId: string) {
  return prisma.$transaction(async (tx) => {
    const webhookSources = await tx.webhookProvider.updateMany({
      where: { isEnabled: true },
      data: { isEnabled: false },
    });
    const webhookEvents = await tx.autocabWebhookConfiguration.updateMany({
      where: { isEnabled: true },
      data: { isEnabled: false },
    });
    const apiEndpoints = await tx.apiEndpointConfiguration.updateMany({
      where: { isEnabled: true },
      data: { isEnabled: false },
    });
    const autocab = await tx.autocabApiConfiguration.updateMany({
      where: { OR: [{ isEnabled: true }, { driverSyncEnabled: true }] },
      data: { isEnabled: false, driverSyncEnabled: false },
    });
    const geoapify = await tx.geoapifyApiConfiguration.updateMany({
      where: { isEnabled: true },
      data: { isEnabled: false },
    });
    const sms = await tx.smsGatewayConfiguration.updateMany({
      where: { isEnabled: true },
      data: { isEnabled: false },
    });
    const counts = {
      webhookSources: webhookSources.count,
      webhookEvents: webhookEvents.count,
      apiEndpoints: apiEndpoints.count,
      autocab: autocab.count,
      geoapify: geoapify.count,
      sms: sms.count,
    };
    await tx.administrationAuditEvent.create({
      data: {
        actorUserId,
        action: "INTEGRATION_CONFIGURATIONS_DISABLED",
        targetType: "IntegrationConfiguration",
        evidence: counts,
      },
    });
    return counts;
  });
}
