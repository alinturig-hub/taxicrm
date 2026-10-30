export function whatsappPhone(value: string): string | null {
  let phone = value.trim().replace(/[\s().-]/g, "");
  if (phone.startsWith("00")) phone = "+" + phone.slice(2);
  if (/^07\d{9}$/.test(phone)) phone = "+44" + phone.slice(1);
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}

export function eligibleCompletion(input: {
  status: string;
  completedAt: Date | null;
  receivedAt: Date;
  enabledSince: Date | null;
}, now = new Date()): boolean {
  const cutoff = now.getTime() - 15 * 60_000;
  return input.status === "COMPLETED" && !!input.completedAt &&
    !!input.enabledSince && input.completedAt >= input.enabledSince &&
    input.receivedAt >= input.enabledSince &&
    input.receivedAt.getTime() >= cutoff && input.receivedAt <= now &&
    input.completedAt.getTime() >= cutoff && input.completedAt <= now;
}

export function completionTemplate(name: string, language: string, customer: string | null, reference: string) {
  return {
    name,
    language: { code: language },
    components: [{ type: "body", parameters: [
      { type: "text", text: (customer?.trim().split(/\s+/)[0] || "Customer").slice(0, 80) },
      { type: "text", text: reference.slice(0, 128) },
    ] }],
  };
}
