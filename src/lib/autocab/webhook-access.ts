import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasAdministrationPermission } from "@/lib/administration-access";
import { bookingEventsOwnedByNeedACabPlus } from "./booking-writer-ownership";
export async function webhookAccess(write: boolean) {
  // Retired TaxiCRM pages may still be open in a browser after deployment.
  // Never let those clients mutate the configuration used by the NAC receiver.
  if (write && bookingEventsOwnedByNeedACabPlus()) return false;
  const session = await getServerSession(authOptions);
  return hasAdministrationPermission(
    session?.user?.email,
    write ? "configuration.manage" : "configuration.view",
  );
}
