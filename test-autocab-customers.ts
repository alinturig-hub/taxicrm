import { getAutocabApiCredentials } from "./src/lib/integrations/autocab/configuration";

async function main() {
  const credentials =
    await getAutocabApiCredentials();

  const baseUrl = credentials.baseUrl
    .trim()
    .replace(/\/+$/, "");

  const response = await fetch(
    `${baseUrl}/accounts/v1/customers`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Ocp-Apim-Subscription-Key":
          credentials.apiKey,
      },
      cache: "no-store",
    },
  );

  const text = await response.text();

  console.log("HTTP:", response.status);
  console.log(text.slice(0, 5000));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
