import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import {
  ADMINISTRATION_PERMISSIONS,
  requireAdministrationPermission,
} from "@/lib/administration-access";
import {
  automationSimulationError,
  simulateAutomationRule,
} from "@/lib/ai-automation-simulation";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(
  _request: Request,
  context: {
    params: {
      id: string;
    };
  },
) {
  const session =
    await getServerSession(authOptions);

  const access =
    await requireAdministrationPermission(
      session?.user?.email,
      ADMINISTRATION_PERMISSIONS
        .AUTOMATION_MANAGE,
    );

  if (!access) {
    return NextResponse.json(
      {
        success: false,
        error: "FORBIDDEN",
      },
      {
        status: 403,
      },
    );
  }

  try {
    const result =
      await simulateAutomationRule({
        ruleId:
          context.params.id,
        actorUserId:
          access.user.id,
      });

    return NextResponse.json(
      result,
    );
  } catch (error) {
    const message =
      automationSimulationError(
        error,
      );

    const notFound =
      message ===
      "Automation rule was not found.";

    console.error(
      "AI automation simulation failed:",
      message,
    );

    return NextResponse.json(
      {
        success: false,
        error: notFound
          ? "AUTOMATION_RULE_NOT_FOUND"
          : "AUTOMATION_SIMULATION_FAILED",
        message,
        externalActionsExecuted:
          false,
        containsPersonalData:
          false,
      },
      {
        status:
          notFound
            ? 404
            : 500,
      },
    );
  }
}
