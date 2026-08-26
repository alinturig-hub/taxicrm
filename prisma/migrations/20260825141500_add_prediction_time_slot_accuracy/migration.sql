ALTER TABLE "CustomerBookingPrediction"
ADD COLUMN "matchedBookingAt" TIMESTAMP(3),
ADD COLUMN "likelyWindowHit" BOOLEAN,
ADD COLUMN "likelyWindowDistanceMinutes" INTEGER;

UPDATE "CustomerBookingPrediction" prediction
SET
  "matchedBookingAt" =
    booking."bookedAtTime",
  "likelyWindowHit" =
    CASE
      WHEN prediction."likelyWindowStartAt" IS NULL
        OR prediction."likelyWindowEndAt" IS NULL
        OR booking."bookedAtTime" IS NULL
      THEN NULL
      ELSE booking."bookedAtTime"
        BETWEEN prediction."likelyWindowStartAt"
        AND prediction."likelyWindowEndAt"
    END,
  "likelyWindowDistanceMinutes" =
    CASE
      WHEN prediction."likelyWindowStartAt" IS NULL
        OR prediction."likelyWindowEndAt" IS NULL
        OR booking."bookedAtTime" IS NULL
      THEN NULL
      WHEN booking."bookedAtTime"
        BETWEEN prediction."likelyWindowStartAt"
        AND prediction."likelyWindowEndAt"
      THEN 0
      WHEN booking."bookedAtTime" <
        prediction."likelyWindowStartAt"
      THEN ROUND(
        EXTRACT(
          EPOCH FROM (
            prediction."likelyWindowStartAt" -
            booking."bookedAtTime"
          )
        ) / 60.0
      )::INTEGER
      ELSE ROUND(
        EXTRACT(
          EPOCH FROM (
            booking."bookedAtTime" -
            prediction."likelyWindowEndAt"
          )
        ) / 60.0
      )::INTEGER
    END
FROM "Booking" booking
WHERE
  prediction.status = 'HIT'
  AND prediction."matchedBookingId" =
    booking.id;
