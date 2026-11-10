import type { WorkspaceCard } from "@/lib/workspace/home/config";
import type { ModuleId } from "@/modules/core/registry";
import { workspaceCardOwner } from "@/modules/core/registry";
export function activeWorkspaceCards(cards: WorkspaceCard[], enabledModules: readonly ModuleId[]) {
  return cards.filter(id => enabledModules.includes(workspaceCardOwner[id]));
}
// Retain hidden cards in account storage while preserving the edited visible order.
export function retainDisabledCards(previous: WorkspaceCard[], incoming: WorkspaceCard[], active: WorkspaceCard[]) {
  const rest = [...incoming], result: WorkspaceCard[] = [];
  for (const id of previous) {
    if (!active.includes(id)) result.push(id);
    else if (rest.length) result.push(rest.shift()!);
  }
  return [...result, ...rest];
}
