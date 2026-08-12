import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function canManageAccounts(
  email: string | null | undefined,
) {
  if (!email) {
    return false;
  }

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
    select: {
      role: true,
      isActive: true,
    },
  });

  return Boolean(
    user?.isActive &&
      (user.role === "ADMIN" ||
        user.role === "MANAGER"),
  );
}

function ruleKey(
  accountId: string,
  accountCode: string,
) {
  return `${accountId}::${accountCode}`;
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json(
      {
        success: false,
        error: "UNAUTHORIZED",
      },
      {
        status: 401,
      },
    );
  }

  try {
    const [bookings, rules] = await Promise.all([
      prisma.booking.findMany({
        where: {
          accountId: {
            not: null,
          },
          accountCode: {
            not: null,
          },
        },
        distinct: [
          "accountId",
          "accountCode",
        ],
        select: {
          accountId: true,
          accountCode: true,
          accountName: true,
        },
        orderBy: {
          accountCode: "asc",
        },
      }),

      prisma.accountRevenueRule.findMany({
        where: {
          provider: "AUTOCAB",
        },
        orderBy: {
          accountCode: "asc",
        },
      }),
    ]);

    const ruleMap = new Map(
      rules.map((rule) => [
        ruleKey(
          rule.accountId,
          rule.accountCode,
        ),
        rule,
      ]),
    );

    const detected = bookings
      .filter(
        (
          booking,
        ): booking is typeof booking & {
          accountId: string;
          accountCode: string;
        } =>
          Boolean(booking.accountId?.trim()) &&
          Boolean(booking.accountCode?.trim()),
      )
      .map((booking) => {
        const accountId =
          booking.accountId.trim();

        const accountCode =
          booking.accountCode.trim();

        const rule = ruleMap.get(
          ruleKey(accountId, accountCode),
        );

        return {
          accountId,
          accountCode,
          displayName:
            rule?.displayName ??
            booking.accountName ??
            accountCode,
          waitingChargeable:
            rule?.waitingChargeable ?? false,
          waitingRatePerMinute:
            Number(
              rule?.waitingRatePerMinute ??
                0.3,
            ),
          configured: Boolean(rule),
        };
      });

    const detectedKeys = new Set(
      detected.map((account) =>
        ruleKey(
          account.accountId,
          account.accountCode,
        ),
      ),
    );

    const configuredOnly = rules
      .filter(
        (rule) =>
          !detectedKeys.has(
            ruleKey(
              rule.accountId,
              rule.accountCode,
            ),
          ),
      )
      .map((rule) => ({
        accountId: rule.accountId,
        accountCode: rule.accountCode,
        displayName:
          rule.displayName ??
          rule.accountCode,
        waitingChargeable:
          rule.waitingChargeable,
        waitingRatePerMinute:
          Number(
            rule.waitingRatePerMinute,
          ),
        configured: true,
      }));

    const accounts = [
      ...detected,
      ...configuredOnly,
    ].sort((a, b) =>
      a.accountCode.localeCompare(
        b.accountCode,
      ),
    );

    return NextResponse.json({
      success: true,
      accounts,
    });
  } catch (error) {
    console.error(
      "Failed to load account revenue rules:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "ACCOUNT_REVENUE_RULES_LOAD_FAILED",
        message:
          "Account revenue rules could not be loaded.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function PUT(
  request: Request,
) {
  const session =
    await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json(
      {
        success: false,
        error: "UNAUTHORIZED",
      },
      {
        status: 401,
      },
    );
  }

  if (
    !(await canManageAccounts(
      session.user.email,
    ))
  ) {
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
    const body =
      (await request.json()) as {
        accountId?: unknown;
        accountCode?: unknown;
        displayName?: unknown;
        waitingChargeable?: unknown;
        waitingRatePerMinute?: unknown;
      };

    if (
      typeof body.accountId !== "string" ||
      body.accountId.trim().length === 0 ||
      typeof body.accountCode !== "string" ||
      body.accountCode.trim().length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "INVALID_ACCOUNT",
          message:
            "Account ID and Account Code are required.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      typeof body.waitingChargeable !==
      "boolean"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "INVALID_WAITING_STATE",
          message:
            "Waiting chargeable state must be true or false.",
        },
        {
          status: 400,
        },
      );
    }

    const rate =
      typeof body.waitingRatePerMinute ===
      "number"
        ? body.waitingRatePerMinute
        : Number(
            body.waitingRatePerMinute,
          );

    if (
      !Number.isFinite(rate) ||
      rate < 0 ||
      rate > 100
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "INVALID_WAITING_RATE",
          message:
            "Waiting rate must be a valid positive amount.",
        },
        {
          status: 400,
        },
      );
    }

    const accountId =
      body.accountId.trim();

    const accountCode =
      body.accountCode.trim();

    const displayName =
      typeof body.displayName === "string" &&
      body.displayName.trim().length > 0
        ? body.displayName.trim()
        : null;

    const rule =
      await prisma.accountRevenueRule.upsert({
        where: {
          provider_accountCode: {
            provider: "AUTOCAB",
            accountCode,
          },
        },
        create: {
          provider: "AUTOCAB",
          accountId,
          accountCode,
          displayName,
          waitingChargeable:
            body.waitingChargeable,
          waitingRatePerMinute: rate,
        },
        update: {
          displayName,
          waitingChargeable:
            body.waitingChargeable,
          waitingRatePerMinute: rate,
        },
      });

    return NextResponse.json({
      success: true,
      rule: {
        accountId: rule.accountId,
        accountCode: rule.accountCode,
        displayName: rule.displayName,
        waitingChargeable:
          rule.waitingChargeable,
        waitingRatePerMinute:
          Number(
            rule.waitingRatePerMinute,
          ),
      },
    });
  } catch (error) {
    console.error(
      "Failed to save account revenue rule:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "ACCOUNT_REVENUE_RULE_SAVE_FAILED",
        message:
          "Account revenue rule could not be saved.",
      },
      {
        status: 500,
      },
    );
  }
}
