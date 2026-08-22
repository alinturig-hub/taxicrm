CREATE TABLE "HourlyWeatherObservation" (
    "id" TEXT NOT NULL,
    "locationKey" TEXT NOT NULL DEFAULT 'PLYMOUTH',
    "latitude" DECIMAL(10,6) NOT NULL,
    "longitude" DECIMAL(10,6) NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "temperature" DECIMAL(7,2),
    "apparentTemperature" DECIMAL(7,2),
    "precipitation" DECIMAL(8,2),
    "rain" DECIMAL(8,2),
    "weatherCode" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'OPEN_METEO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HourlyWeatherObservation_pkey"
      PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX
  "HourlyWeatherObservation_source_locationKey_observedAt_key"
ON "HourlyWeatherObservation"(
  "source",
  "locationKey",
  "observedAt"
);

CREATE INDEX
  "HourlyWeatherObservation_locationKey_observedAt_idx"
ON "HourlyWeatherObservation"(
  "locationKey",
  "observedAt"
);

CREATE INDEX
  "HourlyWeatherObservation_observedAt_idx"
ON "HourlyWeatherObservation"("observedAt");
