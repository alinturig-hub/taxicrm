import { provider as operationsProvider } from "@/modules/operations/booking-workspace";
import { provider as financialProvider } from "@/modules/financial/workspace-provider";
import { provider as customersProvider } from "@/modules/customers/returning-workspace";
import { provider as customersNewProvider } from "@/modules/customers/new-profiles-workspace";
import { provider as predictionsProvider } from "@/modules/predictions/workspace-provider";
import { provider as integrationsProvider } from "@/modules/integrations/event-workspace";
import { workspaceCardOwner } from "@/modules/core/registry";
export const workspaceProviders = [operationsProvider, financialProvider, customersProvider, customersNewProvider, predictionsProvider, integrationsProvider];
const claimed = new Set<string>();
for (const provider of workspaceProviders)
    for (const id of provider.cardIds) {
        if (claimed.has(id) || workspaceCardOwner[id] !== provider.moduleId)
            throw Error(`Invalid workspace provider ownership: ${id}`);
        claimed.add(id);
    }
