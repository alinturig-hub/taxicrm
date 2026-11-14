import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveAgentConfig } from "@/lib/ai/owner-agent/policy";
import { parseRange } from "@/lib/analytics/explorer/model";

test("owner agent uses a separate real read-only role, preserves rows and rejects any writer role", {skip:!process.env.OWNER_AGENT_QA_DATABASE_URL}, async () => {
  const target=new URL(process.env.OWNER_AGENT_QA_DATABASE_URL!);
  assert.equal(target.hostname,"127.0.0.1");assert.equal(target.pathname,"/prediction_qa");assert.equal(target.username,"qa_prediction");
  process.env.DATABASE_URL=target.toString();
  const {prisma}=await import("@/lib/prisma");
  const {readCompanyEvidence,disconnectAgentReader}=await import("@/lib/ai/owner-agent/runtime");
  const roleUrl=(name:string)=>{const u=new URL(target);u.username=name;return u.toString();};
  const provider = "SYNTHETIC_OWNER_AGENT";
  const role = "owner_agent_ro_synthetic", unsafe = "owner_agent_writer_synthetic";
  try {
    await prisma.$executeRawUnsafe(`CREATE ROLE ${role} LOGIN PASSWORD 'synthetic_only'`);
    await prisma.$executeRawUnsafe(`CREATE ROLE ${unsafe} LOGIN PASSWORD 'synthetic_only'`);
    for (const name of [role, unsafe]) {
      await prisma.$executeRawUnsafe(`GRANT CONNECT ON DATABASE prediction_qa TO ${name}`);
      await prisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${name}`);
      await prisma.$executeRawUnsafe(`GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${name}`);
    }
    await prisma.$executeRawUnsafe(`GRANT UPDATE ON public."NormalCustomer" TO ${unsafe}`);
    const base = { TAXICRM_OWNER_AGENT_ENABLED: "true", TAXICRM_AGENT_TENANT_ID: "synthetic-company", TAXICRM_AGENT_COMPANY_NAME: "Synthetic Company", TAXICRM_AGENT_ISOLATION: "DEDICATED_COMPANY_DATABASE", DATABASE_URL: process.env.DATABASE_URL };
    const config = resolveAgentConfig({ ...base, TAXICRM_AGENT_DATABASE_URL: roleUrl(role) });
    await prisma.booking.create({ data: { provider, externalId: "1", status: "COMPLETED", price: 17.1, cost: 19, paymentType: "Cash", pickupDueTime: new Date("2059-01-01T12:00:00Z"), rawPayload: { synthetic: true, loyalty: 1.9 } } });
    const before = await prisma.booking.findMany({ where: { provider } });
    const range = parseRange(new URLSearchParams({ preset: "custom", from: "2059-01-01", to: "2059-01-01" }));
    const result = await readCompanyEvidence(config, range);
    assert.equal(result.totals.total, 1); assert.equal(result.totals.margin, -1.9);
    assert.deepEqual(await prisma.booking.findMany({ where: { provider } }), before);
    await disconnectAgentReader();
    const writer = resolveAgentConfig({ ...base, TAXICRM_AGENT_DATABASE_URL: roleUrl(unsafe) });
    await assert.rejects(readCompanyEvidence(writer, range), /AGENT_ROLE_MUST_BE_READ_ONLY/);
  } finally {
    await disconnectAgentReader();
    await prisma.booking.deleteMany({ where: { provider } });
    for (const name of [role, unsafe]) {
      await prisma.$executeRawUnsafe(`DROP OWNED BY ${name}`).catch(() => { });
      await prisma.$executeRawUnsafe(`DROP ROLE IF EXISTS ${name}`);
    }
    await prisma.$disconnect();
  }
});
