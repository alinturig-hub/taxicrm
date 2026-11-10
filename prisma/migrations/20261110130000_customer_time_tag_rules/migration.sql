CREATE TABLE public."CustomerTimeTagConfiguration" (
 id TEXT NOT NULL PRIMARY KEY,
 revision INTEGER NOT NULL DEFAULT 1,
 rules JSONB NOT NULL,
 "updatedById" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL
);
INSERT INTO public."CustomerTimeTagConfiguration" (id,revision,rules,"updatedById","updatedAt")
VALUES ('default',1,'[{"id": "EARLY_MORNING_USER", "name": "Early Morning User", "start": "04:00", "end": "08:00", "windowDays": 14, "minimumMatches": 3, "minimumPercent": 40, "enabled": true}, {"id": "LATE_EVENING_USER", "name": "Late Evening User", "start": "22:00", "end": "04:00", "windowDays": 14, "minimumMatches": 3, "minimumPercent": 40, "enabled": true}]'::jsonb,'OWNER_INSTALL',CURRENT_TIMESTAMP);
