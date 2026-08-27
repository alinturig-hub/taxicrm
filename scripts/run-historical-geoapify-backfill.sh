#!/bin/sh
set -eu

TAG="taxicrm-historical-geoapify"
MAX_BATCHES=10
BATCH_LIMIT=100
DAILY_CREDIT_CEILING=2000

APP_CONTAINER="$(
  docker ps \
    --filter "label=coolify.resourceName=taxicrm" \
    --filter "label=coolify.environmentName=production" \
    --filter "status=running" \
    --format "{{.ID}}" |
  head -n 1
)"

if [ -z "$APP_CONTAINER" ]; then
  logger -t "$TAG" \
    "TaxiCRM production container was not found."
  exit 1
fi

batch=1
response=""

while [ "$batch" -le "$MAX_BATCHES" ]; do
  if ! response="$(
    docker exec "$APP_CONTAINER" sh -lc \
      'node -e "
void (async () => {
  const response = await fetch(
    \"http://127.0.0.1:3000/api/dashboard/integrations/geoapify/enrich\",
    {
      method: \"POST\",
      headers: {
        \"content-type\": \"application/json\",
        \"x-cron-secret\":
          process.env.CRON_SECRET ?? \"\",
      },
      body: JSON.stringify({
        limit: 100,
        scope: \"HISTORICAL\",
        dailyCreditCeiling: 2000,
      }),
    },
  );

  const payload = await response.json();

  console.log(JSON.stringify({
    httpStatus: response.status,
    ...payload,
  }));

  if (!response.ok || !payload.success) {
    process.exitCode = 1;
  }
})().catch((error) => {
  console.error(JSON.stringify({
    success: false,
    error:
      error instanceof Error
        ? error.message
        : \"Unknown error\",
    containsPersonalData: false,
  }));
  process.exitCode = 1;
});
"'
  )"
  then
    logger -t "$TAG" \
      "Historical Geoapify batch failed: $response"
    printf "%s\n" "$response"
    exit 1
  fi

  logger -t "$TAG" -- "$response"

  continue_processing="$(
    node -e '
const payload = JSON.parse(process.argv[1]);

process.stdout.write(
  payload.hasMore &&
  !payload.stoppedAtDailyCreditCeiling
    ? "true"
    : "false"
);
' "$response"
  )"

  if [ "$continue_processing" != "true" ]; then
    break
  fi

  batch=$((batch + 1))
done

printf "%s\n" "$response"
