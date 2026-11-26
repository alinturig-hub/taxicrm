import { moduleApiBlock } from "@/modules/core/activation/access";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import {
  ADMINISTRATION_PERMISSIONS,
  requireAdministrationPermission,
} from "@/lib/administration-access";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { automationScheduleMinutes, historicalBackfillEnabled } from "@/lib/scheduler-result.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const session =
    await getServerSession(authOptions);

  const access =
    await requireAdministrationPermission(
      session?.user?.email,
      ADMINISTRATION_PERMISSIONS
        .AUTOMATION_VIEW,
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

  const moduleBlock = await moduleApiBlock("automation");
  if (moduleBlock) return moduleBlock;

  try {
    const rules =
      await prisma.automationRule.findMany({
        orderBy: {
          name: "asc",
        },
        include: {
          executions: {
            orderBy: {
              startedAt: "desc",
            },
            take: 5,
            select: {
              id: true,
              mode: true,
              status: true,
              source: true,
              startedAt: true,
              finishedAt: true,
              durationMs: true,
              selected: true,
              processed: true,
              succeeded: true,
              failed: true,
              hasMore: true,
              evidence: true,
              error: true,
            },
          },
        },
      });

    const latestRuns = await Promise.all(rules.map(({ jobKey }) =>
      prisma.customerIntelligenceJobRun.findFirst({
        where: { jobKey },
        orderBy: [{ startedAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          status: true,
          source: true,
          startedAt: true,
          finishedAt: true,
          durationMs: true,
          selected: true,
          processed: true,
          succeeded: true,
          failed: true,
          hasMore: true,
        },
      }),
    ));
    const scheduleMinutes: Readonly<Record<string, number | undefined>> = automationScheduleMinutes;

    const canManage =
      access.isSuperAdmin ||
      access.permissions.includes(
        ADMINISTRATION_PERMISSIONS
          .AUTOMATION_MANAGE,
      );

    return NextResponse.json({
      success: true,
      generatedAt:
        new Date(),
      access: {
        canView: true,
        canManage,
      },
      safeguards: {
        defaultMode:
          "SIMULATION",
        existingCronsPreserved:
          true,
        directExecutionEnabled:
          false,
        customerContactEnabled:
          false,
      },
      rules: rules.map(
        (rule, index) => ({
          id: rule.id,
          key: rule.key,
          name: rule.name,
          description:
            rule.description,
          jobKey: rule.jobKey,
          status: rule.status,
          mode: rule.mode,
          requiresApproval:
            rule.requiresApproval,
          expectedIntervalMin:
            rule.expectedIntervalMin,
          defaultBatchSize:
            rule.defaultBatchSize,
          configuration:
            rule.configuration,
          lastSimulatedAt:
            rule.lastSimulatedAt,
          lastExecutedAt:
            rule.lastExecutedAt,
          simulations:
            rule.executions,
          latestJobRun: latestRuns[index],
          scheduler: scheduleMinutes[rule.jobKey] === undefined ? null : {
            intervalMinutes: scheduleMinutes[rule.jobKey],
            configured: Boolean(process.env.CRON_SECRET) &&
              (rule.jobKey !== "HISTORICAL_GEOAPIFY_BACKFILL" || historicalBackfillEnabled()),
          },
        }),
      ),
      privacy: {
        aggregateOnly: true,
        containsPersonalData: false,
        containsCustomerIdentity: false,
        containsContactDetails: false,
      },
    });
  } catch (error) {
    console.error(
      "AI automation dashboard failed:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "AI_AUTOMATION_DASHBOARD_FAILED",
        message:
          "Automation controls could not be loaded.",
      },
      {
        status: 500,
      },
    );
  }
}
