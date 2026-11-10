import { prisma } from "@/lib/prisma";
import { defaultConfig, visibleConfig, type Can, type WorkspaceConfig } from "./config";
export async function loadWorkspacePreference(userId: string, can: Can) {
    const row = await prisma.userWorkspacePreference.findUnique({ where: { userId } });
    return { revision: row?.revision ?? 0, config: row ? visibleConfig(row.configuration, can) : defaultConfig(can) };
}
export async function saveWorkspacePreference(userId: string, revision: number, config: WorkspaceConfig) {
    try {
        return await prisma.$transaction(async (tx) => {
            if (revision === 0) {
                return tx.userWorkspacePreference.create({ data: { userId, configuration: config } });
            }
            const result = await tx.userWorkspacePreference.updateMany({ where: { userId, revision }, data: { configuration: config, revision: { increment: 1 } } });
            if (result.count !== 1)
                throw Error("WORKSPACE_VERSION_CONFLICT");
            return tx.userWorkspacePreference.findUniqueOrThrow({ where: { userId } });
        });
    }
    catch (e) {
        if (e instanceof Error && ("code" in e && e.code === "P2002"))
            throw Error("WORKSPACE_VERSION_CONFLICT");
        throw e;
    }
}
