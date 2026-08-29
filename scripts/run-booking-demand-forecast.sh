#!/bin/sh

set -u

APP_CONTAINER="$(
  docker ps     --filter 'label=coolify.resourceName=taxicrm'     --filter 'label=coolify.environmentName=production'     --filter 'status=running'     --format '{{.ID}}' |
  head -n 1
)"

if [ -z "$APP_CONTAINER" ]; then
  MESSAGE='{"success":false,"error":"TAXICRM_CONTAINER_NOT_FOUND","containsPersonalData":false}'
  logger -t taxicrm-booking-demand -- "$MESSAGE"
  printf "%s\n" "$MESSAGE"
  exit 1
fi

OUTPUT="$(
  docker exec "$APP_CONTAINER" sh -lc '
    node -e "
      void (async () => {
        const response = await fetch(
          \"http://127.0.0.1:3000/api/internal/booking-demand-forecast\",
          {
            method: \"POST\",
            headers: {
              \"content-type\": \"application/json\",
              \"x-cron-secret\":
                process.env.CRON_SECRET ?? \"\",
            },
            body: JSON.stringify({}),
          },
        );

        const payload =
          await response.json();

        console.log(
          JSON.stringify({
            httpStatus:
              response.status,
            success:
              payload.success,
            created:
              payload.created,
            evaluatedExpired:
              payload.evaluatedExpired,
            forecastId:
              payload.forecast?.id ??
              null,
            predictedBookings:
              payload.forecast
                ?.predictedBookings ??
              null,
            lowerBound:
              payload.forecast
                ?.lowerBound ??
              null,
            upperBound:
              payload.forecast
                ?.upperBound ??
              null,
            windowStartAt:
              payload.forecast
                ?.windowStartAt ??
              null,
            windowEndAt:
              payload.forecast
                ?.windowEndAt ??
              null,
            containsPersonalData:
              payload
                .containsPersonalData ??
              false,
          }),
        );

        if (
          !response.ok ||
          !payload.success ||
          payload
            .containsPersonalData !==
            false
        ) {
          process.exitCode = 1;
        }
      })().catch((error) => {
        console.error(
          JSON.stringify({
            success: false,
            error:
              error instanceof Error
                ? error.message
                : \"Unknown error\",
            containsPersonalData:
              false,
          }),
        );
        process.exitCode = 1;
      });
    "
  '
)"
STATUS=$?

logger -t taxicrm-booking-demand -- "$OUTPUT"
printf "%s\n" "$OUTPUT"

exit "$STATUS"
