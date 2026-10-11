import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { prisma } from "../../src/lib/prisma";
import { storeApiResponse } from "../../src/lib/integrations/autocab/generic-api-sync/store";

if (process.env.TAXICRM_SYNTHETIC_TESTS !== "1" || process.env.DATABASE_URL !== "postgresql://taxicrm@127.0.0.1:5432/taxicrm") throw new Error("Requires opted-in isolated database.");
const url = `https://example.test/synthetic-${randomUUID()}`;
after(async () => { await prisma.apiEndpointConfiguration.deleteMany({where: {url}}); await prisma.$disconnect(); });
test("API preview data persists atomically without another provider fetch, duplicates or lost records", async () => {
  const endpoint = await prisma.apiEndpointConfiguration.create({data: {url, provider: "AUTOCAB", name: "Synthetic zones"}});
  const payload = [{id: 0, companyId: 2, active: false, nested: {coordinates: [1, 2]}}, {id: "001", active: true}];
  assert.equal((await storeApiResponse(endpoint.id, payload, "id")).created, 2);
  assert.equal((await storeApiResponse(endpoint.id, payload, "id")).created, 0);
  assert.deepEqual((await prisma.apiEndpointRecord.findUniqueOrThrow({where: {endpointId_externalId: {endpointId: endpoint.id, externalId: "0"}}})).data, payload[0]);
  await assert.rejects(storeApiResponse(endpoint.id, [{id: 0, overwritten: true}, {missing: true}], "id"), /valid id/);
  assert.deepEqual((await prisma.apiEndpointConfiguration.findUniqueOrThrow({where: {id: endpoint.id}})).sampleResponse, payload);
  await storeApiResponse(endpoint.id, [{id: 0}], "id");
  assert.equal(await prisma.apiEndpointRecord.count({where: {endpointId: endpoint.id, isActive: true}}), 2, "a partial response must not deactivate other saved records");
  for (const value of [{zones: payload}, null, 0]) {
    await storeApiResponse(endpoint.id, value, null);
    assert.deepEqual((await prisma.apiEndpointRecord.findUniqueOrThrow({where: {endpointId_externalId: {endpointId: endpoint.id, externalId: "$response"}}})).data, value);
  }
});
