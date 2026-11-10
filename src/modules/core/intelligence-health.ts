import { prisma } from "@/lib/prisma";
import { CUSTOMER_INTELLIGENCE_JOBS } from "@/lib/customers/customer-intelligence-job-runs";
export async function coreHealthWithoutPredictions() {
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SET LOCAL statement_timeout='10s'`;
    const [customers, snapshots, places, recentJobs] = await Promise.all([
      tx.normalCustomer.count(), tx.customerProfileSnapshot.count(),
      tx.placeIntelligence.groupBy({ by: ["status"], _count: { _all: true } }),
      tx.customerIntelligenceJobRun.findMany({ where: { jobKey: { notIn: [CUSTOMER_INTELLIGENCE_JOBS.BOOKING_PREDICTIONS, CUSTOMER_INTELLIGENCE_JOBS.BOOKING_DEMAND_FORECAST] } }, orderBy: { startedAt: "desc" }, take: 15,
        select: { id: true, jobKey: true, status: true, startedAt: true, finishedAt: true, message: true } }),
    ]);
    return { customers, snapshots, places: places.map(p => ({ status: p.status, count: p._count._all })), recentJobs };
  }, { timeout: 15000 });
}
