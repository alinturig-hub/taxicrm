import { prisma } from "@/lib/prisma";

type SnapshotInput = {
  customerId: string;
  profile: {
    overview: {
      totalBookings: number;
    };
    classification: {
      lifecycle: string;
      profileSafeForPersonalisation: boolean;
    };
  };
  needPropensity: {
    score: number | null;
    level: string;
    confidence: number;
  };
  relationshipQuality: {
    score: number | null;
    level: string;
  };
  customerRhythm: {
    regularityScore: number | null;
    scheduleStatus: string;
  };
  returnJourney: {
    returnRate: number;
  };
  serviceOutcomes: {
    level: string;
    recentAdverseRate: number;
  };
  profileDataQuality: {
    score: number;
    grade: string;
  };
  behaviourChange: {
    changeScore: number | null;
    direction: string;
  };
};

const londonDateFormatter =
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

export function londonSnapshotDate(
  value = new Date(),
) {
  const parts =
    londonDateFormatter.formatToParts(
      value,
    );

  const year = Number(
    parts.find(
      (part) => part.type === "year",
    )?.value,
  );
  const month = Number(
    parts.find(
      (part) => part.type === "month",
    )?.value,
  );
  const day = Number(
    parts.find(
      (part) => part.type === "day",
    )?.value,
  );

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    throw new Error(
      "London snapshot date could not be determined.",
    );
  }

  return new Date(
    Date.UTC(year, month - 1, day),
  );
}

export async function saveCustomerProfileSnapshot(
  input: SnapshotInput,
  now = new Date(),
) {
  const snapshotDate =
    londonSnapshotDate(now);

  const values = {
    generatedAt: now,
    totalBookings:
      input.profile.overview.totalBookings,
    profileSafe:
      input.profile.classification
        .profileSafeForPersonalisation,
    lifecycle:
      input.profile.classification
        .lifecycle,
    needScore:
      input.needPropensity.score,
    needLevel:
      input.needPropensity.level,
    needConfidence:
      input.needPropensity.confidence,
    relationshipScore:
      input.relationshipQuality.score,
    relationshipLevel:
      input.relationshipQuality.level,
    regularityScore:
      input.customerRhythm
        .regularityScore,
    scheduleStatus:
      input.customerRhythm
        .scheduleStatus,
    returnRate:
      input.returnJourney.returnRate,
    serviceOutcomeLevel:
      input.serviceOutcomes.level,
    recentAdverseRate:
      input.serviceOutcomes
        .recentAdverseRate,
    dataQualityScore:
      input.profileDataQuality.score,
    dataQualityGrade:
      input.profileDataQuality.grade,
    behaviourChangeScore:
      input.behaviourChange.changeScore,
    behaviourChangeDirection:
      input.behaviourChange.direction,
  };

  return prisma.customerProfileSnapshot.upsert({
    where: {
      normalCustomerId_snapshotDate: {
        normalCustomerId:
          input.customerId,
        snapshotDate,
      },
    },
    create: {
      normalCustomerId:
        input.customerId,
      snapshotDate,
      ...values,
    },
    update: values,
  });
}

export async function getCustomerProfileHistory(
  customerId: string,
  limit = 30,
) {
  const snapshots =
    await prisma.customerProfileSnapshot.findMany({
      where: {
        normalCustomerId: customerId,
      },
      orderBy: {
        snapshotDate: "desc",
      },
      take: Math.min(
        Math.max(limit, 1),
        90,
      ),
      select: {
        snapshotDate: true,
        generatedAt: true,
        totalBookings: true,
        profileSafe: true,
        lifecycle: true,
        needScore: true,
        needLevel: true,
        needConfidence: true,
        relationshipScore: true,
        relationshipLevel: true,
        regularityScore: true,
        scheduleStatus: true,
        returnRate: true,
        serviceOutcomeLevel: true,
        recentAdverseRate: true,
        dataQualityScore: true,
        dataQualityGrade: true,
        behaviourChangeScore: true,
        behaviourChangeDirection: true,
      },
    });

  return snapshots.map(
    (snapshot) => ({
      snapshotDate:
        snapshot.snapshotDate
          .toISOString()
          .slice(0, 10),
      generatedAt:
        snapshot.generatedAt
          .toISOString(),
      totalBookings:
        snapshot.totalBookings,
      profileSafe:
        snapshot.profileSafe,
      lifecycle: snapshot.lifecycle,
      needScore: snapshot.needScore,
      needLevel: snapshot.needLevel,
      needConfidence:
        snapshot.needConfidence,
      relationshipScore:
        snapshot.relationshipScore,
      relationshipLevel:
        snapshot.relationshipLevel,
      regularityScore:
        snapshot.regularityScore,
      scheduleStatus:
        snapshot.scheduleStatus,
      returnRate: Number(
        snapshot.returnRate,
      ),
      serviceOutcomeLevel:
        snapshot.serviceOutcomeLevel,
      recentAdverseRate: Number(
        snapshot.recentAdverseRate,
      ),
      dataQualityScore:
        snapshot.dataQualityScore,
      dataQualityGrade:
        snapshot.dataQualityGrade,
      behaviourChangeScore:
        snapshot.behaviourChangeScore,
      behaviourChangeDirection:
        snapshot.behaviourChangeDirection,
    }),
  );
}
