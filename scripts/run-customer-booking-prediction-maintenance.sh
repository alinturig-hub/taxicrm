#!/bin/sh
set -eu

TAG="taxicrm-booking-predictions"
MAX_BATCHES=4
BATCH_LIMIT=50

APP_CONTAINER="$(
  docker ps     --filter "label=coolify.resourceName=taxicrm"     --filter "label=coolify.environmentName=production"     --filter "status=running"     --format "{{.ID}}" |
  head -n 1
)"

if [ -z "$APP_CONTAINER" ]; then
  logger -t "$TAG"     "TaxiCRM production container was not found."
  exit 1
fi

batch=1

while [ "$batch" -le "$MAX_BATCHES" ]; do
  if ! response="$(
    docker exec "$APP_CONTAINER" sh -lc       'node -e "
void (async () => {
  const response = await fetch(
    \"http://127.0.0.1:3000/api/internal/customer-booking-predictions\",
    {
      method: \"POST\",
      headers: {
        \"content-type\": \"application/json\",
        \"x-cron-secret\":
          process.env.CRON_SECRET ?? \"\",
      },
      body: JSON.stringify({
        limit: 50,
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
})();
"'
  )"
  then
    logger -t "$TAG"       "Prediction maintenance failed: $response"
    exit 1
  fi

  logger -t "$TAG" "$response"

  has_more="$(
    node -e '
const payload = JSON.parse(process.argv[1]);
process.stdout.write(
  payload.hasMore ? "true" : "false"
);
' "$response"
  )"

  if [ "$has_more" != "true" ]; then
    break
  fi

  batch=$((batch + 1))
done

printf '%s\n' "$response"
