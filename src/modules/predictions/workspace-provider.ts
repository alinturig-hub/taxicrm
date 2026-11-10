import type { WorkspaceProvider, WorkspaceTask } from "@/modules/core/contracts/workspace";
import { predictionUnit, predictionPrisma as prisma, predictionEpochWhere } from "./lifecycle";
import { BOOKING_PREDICTION_MODEL_VERSION } from "@/lib/customers/booking-prediction-model";
export const provider: WorkspaceProvider = { moduleId: "predictions", cardIds: ["predictions"], createTask(context) {
        const { ids, now, assign } = context;
        const wants = (id: typeof ids[number]) => ids.includes(id);
        const tasks: WorkspaceTask[] = [];
        if (wants("predictions"))
            tasks.push({ ids: ["predictions"], run: async () => predictionUnit(async () => { const n = await prisma.customerBookingPrediction.count({ where: { modelVersion: BOOKING_PREDICTION_MODEL_VERSION, status: "PENDING", windowEndAt: { gt: now }, issuedAt: { lte: now, ...("issuedAt" in predictionEpochWhere() ? predictionEpochWhere().issuedAt : {}) } } }); assign("predictions", n, null, { snapshot: true }); }) });
        return tasks[0] ?? null;
    } };
