ALTER TABLE "HourlyWeatherObservation"
  ADD COLUMN "snowfall" DECIMAL(8,2),
  ADD COLUMN "windSpeed" DECIMAL(8,2),
  ADD COLUMN "windGusts" DECIMAL(8,2),
  ADD COLUMN "cloudCover" INTEGER,
  ADD COLUMN "visibility" DECIMAL(12,2),
  ADD COLUMN "isDay" BOOLEAN;
