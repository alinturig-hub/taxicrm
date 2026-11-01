import { WhatsAppError } from "./settings";

const active = new Set<string>();
const last = new Map<string, number>();

export function reserveWhatsAppList(user: string, now = Date.now()) {
  if (
    active.has(user) ||
    active.size >= 2 ||
    now - (last.get(user) ?? -Infinity) < 5_000
  ) {
    throw new WhatsAppError("WHATSAPP_BUSY_RETRY", 429);
  }

  if (last.size >= 1_000) {
    last.delete(last.keys().next().value!);
  }

  active.add(user);
  last.set(user, now);
  return () => {
    active.delete(user);
  };
}
