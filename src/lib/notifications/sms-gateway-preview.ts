export type SmsGatewayDraft = {
  endpoint: string;
  phoneParameter: string;
  messageParameter: string;
  senderParameter: string;
  sender: string;
};

export function smsGatewayPreview(configuration: SmsGatewayDraft, phone: string, message: string) {
  const url = new URL(configuration.endpoint.trim());
  if (url.protocol !== "https:" || url.username || url.password || url.hash) {
    throw new Error("Use an HTTPS endpoint without embedded credentials or a fragment.");
  }
  const parameters = [configuration.phoneParameter, configuration.messageParameter, configuration.senderParameter].map(value => value.trim());
  if (parameters.some(value => !/^[A-Za-z][A-Za-z0-9_]*$/.test(value) || ["constructor", "prototype"].includes(value)) || new Set(parameters).size !== 3) {
    throw new Error("Use three distinct parameter names containing letters, digits or underscores.");
  }
  const destination = phone.replace(/[\s()-]/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(destination)) throw new Error("Use an international destination number starting with +.");
  if (!message.trim() || !configuration.sender.trim()) throw new Error("Message and sender are required.");
  return {
    method: "POST",
    format: "POST_JSON",
    endpoint: `${url.origin}${url.pathname}`,
    signedParametersPresent: Boolean(url.search),
    body: Object.fromEntries([[parameters[0], destination], [parameters[1], message], [parameters[2], configuration.sender.trim()]]),
    simulationOnly: true,
  };
}
