-- One-time authorised backfill. Run in a transaction on the active shared database.
SET LOCAL statement_timeout='90s';
SET LOCAL lock_timeout='5s';
WITH mobile AS MATERIALIZED (
 SELECT "normalCustomerId" AS customer_id, count(*)::int AS evidence,
 min(coalesce("bookedAtTime","createdAt")) AS first_seen,
 max(coalesce("bookedAtTime","createdAt")) AS last_seen
 FROM "Booking" WHERE "bookingSource"='MobileApp' AND "normalCustomerId" IS NOT NULL
 GROUP BY "normalCustomerId"
), totals AS MATERIALIZED (
 SELECT b."normalCustomerId" AS customer_id,count(*)::int AS eligible
 FROM "Booking" b JOIN mobile m ON m.customer_id=b."normalCustomerId" GROUP BY b."normalCustomerId"
), saved AS (
 INSERT INTO "CustomerBehaviourTag" (id,"normalCustomerId","tagId",label,category,confidence,"evidenceCount","eligibleCount",percentage,"windowDays","windowStartAt","windowEndAt","lastObservedAt",active,source,"modelVersion",explanation,"createdAt","updatedAt")
 SELECT 'mobileapp_'||md5(m.customer_id),m.customer_id,'MOBILE_APP_USER','Mobile app user','BOOKING','STRONG',m.evidence,t.eligible,round(100.0*m.evidence/t.eligible,2),greatest(1,ceil(extract(epoch from (now()-m.first_seen))/86400)::int),m.first_seen,now(),m.last_seen,true,'BOOKING_CHANNEL','AUTOCAB_MOBILE_APP_V1',
 'Historical Autocab bookingSource=MobileApp evidence. Confirms past mobile-app booking use, not current installation, exclusive booking channel or WhatsApp consent.',now(),now()
 FROM mobile m JOIN totals t ON t.customer_id=m.customer_id JOIN "NormalCustomer" c ON c.id=m.customer_id
 ON CONFLICT ("normalCustomerId","tagId") DO UPDATE SET
 label=excluded.label,category=excluded.category,confidence=excluded.confidence,"evidenceCount"=excluded."evidenceCount","eligibleCount"=excluded."eligibleCount",percentage=excluded.percentage,"windowDays"=excluded."windowDays","windowStartAt"=excluded."windowStartAt","windowEndAt"=excluded."windowEndAt","lastObservedAt"=excluded."lastObservedAt",active=true,"updatedAt"=now()
 WHERE "CustomerBehaviourTag".source='BOOKING_CHANNEL'
 RETURNING id
) SELECT count(*) AS tagged_customers FROM saved;
SELECT count(*) AS active_mobile_app_tags FROM "CustomerBehaviourTag" WHERE "tagId"='MOBILE_APP_USER' AND source='BOOKING_CHANNEL' AND active;
