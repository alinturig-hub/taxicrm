-- Required by the uncalibrated frequency model. Existing rates are preserved.
ALTER TABLE public."CustomerBookingPrediction" ALTER COLUMN "observedRate" DROP NOT NULL;
