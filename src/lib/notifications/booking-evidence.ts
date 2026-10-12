import { Prisma } from "@/generated/prisma/client";
/** Read canonical provider evidence only; never use import/received/pickup time as booking creation time. */
export function originalBookingTimeSql() {
  const value = Prisma.sql`"rawPayload"->>'BookedAtTime'`;
  return Prisma.sql`CASE WHEN ${value} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$' AND pg_input_is_valid(${value}, 'timestamp with time zone') THEN (${value})::timestamptz ELSE NULL END`;
}
export function bookingTimeSql() {
  return Prisma.sql`coalesce("bookedAtTime", ${originalBookingTimeSql()})`;
}
