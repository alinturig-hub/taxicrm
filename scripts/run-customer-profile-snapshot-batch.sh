#!/bin/sh

set -u

APP_CONTAINER="$(
  docker ps \
    --filter "label=coolify.resourceName=taxicrm" \
    --filter "label=coolify.environmentName=production" \
    --filter "status=running" \
    --format "{{.ID}}" |
  head -n 1
)"

if [ -z "$APP_CONTAINER" ]; then
  logger -t taxicrm-profile-snapshots \
    "TaxiCRM application container was not found."
  exit 1
fi

OUTPUT="$(
  docker exec "$APP_CONTAINER" node -e '
void (async () => {
  const response = await fetch(
    "http://127.0.0.1:3000/api/internal/customer-profile-snapshots",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-cron-secret":
          process.env.CRON_SECRET ?? "",
      },
      body: JSON.stringify({
        limit: 50,
      }),
    },
  );

  const text = await response.text();

  console.log(text);

  if (!response.ok) {
    process.exitCode = 1;
  }
})().catch((error) => {
  console.error(
    "Customer snapshot request failed:",
    error instanceof Error
      ? error.message
      : "Unknown error",
  );
  process.exitCode = 1;
});
'
)"
STATUS=$?

logger -t taxicrm-profile-snapshots -- "$OUTPUT"
printf "%s\n" "$OUTPUT"

exit "$STATUS"
