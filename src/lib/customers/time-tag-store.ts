import { parseLocationRules } from "./location-tag-rules";
import { prisma } from "@/lib/prisma";
import { defaultTimeTagRules, parseTimeTagRules } from "./time-tag-rules";
export async function loadTimeTagRules() {
    const row = await prisma.customerTimeTagConfiguration.findUnique({ where: { id: "default" } });
    return { revision: row?.revision ?? 0, rules: row ? parseTimeTagRules(row.rules) : defaultTimeTagRules, placeRules: row?.placeRules ? parseLocationRules(row.placeRules) : [] };
}
