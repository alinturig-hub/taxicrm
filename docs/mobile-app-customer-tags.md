# Mobile-app customer segmentation

On 30 October 2026, a read-only audit of the active shared database confirmed these distinct Autocab `bookingSource` values: `MobileApp`, `OperatorWeb`, `Operator`, `WebBooking`, `FlaggedBooking`, `ThirdPartyOther`, and `MarketPlaceApp`. Only the exact `MobileApp` value qualifies for this tag. OperatorWeb is not treated as a customer webapp booking.

The full-history audit found 828,242 MobileApp bookings, linked to 43,646 existing NormalCustomer profiles (808,389 linked bookings and 19,853 unlinked bookings). The recent 90-day cohort contained 36,648 bookings and 7,254 profiles. These are audit-time counts, not fixed future totals.

The authorised one-time backfill created 43,646 active `CustomerBehaviourTag` records with tag ID `MOBILE_APP_USER`, label `Mobile app user`, source `BOOKING_CHANNEL`, and model version `AUTOCAB_MOBILE_APP_V1`. Evidence count records the number of exact MobileApp bookings, eligible count all bookings linked to that profile, and percentage their ratio. Evidence dates span the observed history, not the behavioural 14-day window. No customer identifiers were exported in the report. Unlinked bookings were not guessed or attached to another profile.

This tag establishes historical app booking use; it does not establish a current installation, exclusive booking channel, identity of the passenger, or WhatsApp consent. Messaging eligibility must use the source of the individual booking and recorded consent, not exclude every future telephone booking by a historically tagged client.

The existing customers list reads these tags and builds its filter options from the database, so the backfill is immediately visible there. The behavioural recalculation needs the accompanying `source: AUTOMATIC` ownership filter deployed to preserve channel tags. This patch is saved for review; until deployed, the old production recalculation can deactivate channel tags. This is a one-time backfill, not yet automatic tagging of new app users or a change to the profile drawer's computed behavioural summary.

Verification: the write reported 43,646 saved records and 43,646 active matching tags. The source ownership regression test ensures behaviour recalculation expires automatic tags while keeping historical channel tags.
