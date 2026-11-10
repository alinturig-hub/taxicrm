import {test} from "node:test";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {mkdtemp,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {cards,type WorkspaceCard} from "@/lib/workspace/home/config";

test("extracted module providers preserve the deployed summary contract",{skip:!process.env.MODULE_PARITY_QA_DATABASE_URL},async()=>{
 const url=new URL(process.env.MODULE_PARITY_QA_DATABASE_URL!);assert.equal(url.hostname,"127.0.0.1");assert.equal(url.pathname,"/workspace_qa");assert.equal(url.username,"qa_workspace");process.env.DATABASE_URL=url.toString();
 const {prisma}=await import("@/lib/prisma");const {workspaceSummary}=await import("@/modules/my-workspace/summary");
 const temp=await mkdtemp(join(tmpdir(),"module-summary-baseline-"));
 const source=execFileSync("git",["show","c4fea3f85089e2d04afb34473ee0c73b9e52890b:src/lib/workspace/home/summary.ts"],{encoding:"utf8"});
 const baselinePath=join(temp,"baseline.ts");await writeFile(baselinePath,source);await writeFile(join(temp,"config.ts"),execFileSync("git",["show","c4fea3f85089e2d04afb34473ee0c73b9e52890b:src/lib/workspace/home/config.ts"],{encoding:"utf8"}));const {workspaceSummary:baseline}=await import(baselinePath);
 const customerId="qa-module-parity",provider="SYNTHETIC_MODULE_PARITY",now=new Date("2059-11-10T12:00:00Z");
 try{
  await prisma.normalCustomer.create({data:{id:customerId,normalizedTelephone:"+447700900089",telephoneNumber:"+447700900089",createdAt:new Date("2059-11-10T06:00:00Z")}});
  await prisma.booking.createMany({data:[{externalId:"prior",status:"COMPLETED",completedAt:new Date("2059-11-08T09:00:00Z"),price:20,cost:15},{externalId:"current",status:"COMPLETED",completedAt:new Date("2059-11-10T09:00:00Z"),price:10,cost:12},{externalId:"unknown",status:"COMPLETED",completedAt:new Date("2059-11-10T10:00:00Z"),price:null,cost:3}].map(row=>({...row,provider,normalCustomerId:customerId,bookedAtTime:row.completedAt,pickupDueTime:row.completedAt,rawPayload:{synthetic:true}}))});
  await prisma.customerBookingPrediction.create({data:{id:"qa-module-signal",normalCustomerId:customerId,modelVersion:"FREQUENCY_REFERENCE_V1",horizonHours:24,issuedAt:new Date("2059-11-10T11:00:00Z"),windowStartAt:now,windowEndAt:new Date("2059-11-11T12:00:00Z"),score:20,level:"MODERATE",observedRate:null,evidenceConfidence:0,calibrationSamples:0,status:"PENDING",inputFingerprint:"synthetic-module-parity"}});
  await prisma.webhookEvent.create({data:{id:"qa-module-event",provider,eventType:"SYNTHETIC",idempotencyKey:"qa-module-parity-event",status:"FAILED",payload:{synthetic:true},receivedAt:new Date("2059-11-10T09:00:00Z")}});
  const before=await prisma.booking.findMany({where:{provider},orderBy:{id:"asc"}});
  const requested=Object.keys(cards) as WorkspaceCard[];
  for(const period of ["TODAY","YESTERDAY","LAST7","LAST30"] as const){
   assert.deepEqual(await workspaceSummary(requested,period,()=>true,now),await baseline(requested,period,()=>true,now));
   assert.deepEqual(await workspaceSummary(requested,period,(p:string)=>p==="bookings.view",now),await baseline(requested,period,(p:string)=>p==="bookings.view",now));
  }
  const result=await workspaceSummary(requested,"TODAY",()=>true,now);assert.equal(result.metrics.predictions?.value,1);assert.equal(result.metrics.newProfiles?.value,1);assert.equal(result.metrics.failed?.value,1);
  assert.deepEqual(await prisma.booking.findMany({where:{provider},orderBy:{id:"asc"}}),before);
 }finally{await prisma.customerBookingPrediction.deleteMany({where:{id:"qa-module-signal"}});await prisma.webhookEvent.deleteMany({where:{id:"qa-module-event"}});await prisma.booking.deleteMany({where:{provider}});await prisma.normalCustomer.deleteMany({where:{id:customerId}});await prisma.$disconnect();await rm(temp,{recursive:true,force:true});}
});
