import { NextResponse } from "next/server";
import { getAutocabHealth } from "@/lib/integrations/autocab-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const autocab = await getAutocabHealth();

    return NextResponse.json({
      success: true,
      integrations: [
        {
          id: "autocab",
          name: "Autocab",
          description: "Bookings, Drivers, Vehicles & Webhooks",
          href: "/dashboard/integrations/autocab",
          ...autocab,
        },
      ],
    });
  } catch (error) {
    console.error("Failed to load integrations:", error);

    return NextResponse.json(
      {
        success: false,
        error: "INTEGRATIONS_LOAD_FAILED",
      },
      {
        status: 500,
      },
    );
  }
}
