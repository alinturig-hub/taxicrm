import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
export async function workspaceQuery<T>(sql: Prisma.Sql) { return prisma.$transaction(async (tx) => { await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY"); await tx.$executeRawUnsafe("SET LOCAL statement_timeout='10s'"); await tx.$executeRawUnsafe("SET LOCAL lock_timeout='2s'"); return tx.$queryRaw<T[]>(sql); }, { timeout: 15000 }); }
