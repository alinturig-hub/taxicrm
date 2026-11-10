import {test} from "node:test";
import assert from "node:assert/strict";
import {defaultConfig} from "@/lib/workspace/home/config";
// Import database clients only after proving this is the isolated synthetic target.
test("workspace metrics and account preference isolation",{skip:!process.env.WORKSPACE_QA_DATABASE_URL},async t=>{
 const u=new URL(process.env.WORKSPACE_QA_DATABASE_URL!);assert.equal(u.hostname,"127.0.0.1");assert.equal(u.pathname,"/workspace_qa");assert.equal(u.username,"qa_workspace");process.env.DATABASE_URL=u.toString();
 const {prisma}=await import("@/lib/prisma"),{workspaceSummary}=await import("@/lib/workspace/home/summary"),{loadWorkspacePreference,saveWorkspacePreference}=await import("@/lib/workspace/home/preferences");
 const now=new Date("2059-11-10T12:00:00Z"),all=()=>true,owner="qa-ws-unit-owner",other="qa-ws-unit-other",customer="qa-ws-unit-contact",provider="SYNTHETIC_WORKSPACE_UNIT";
 try{
  await prisma.user.createMany({data:[{id:owner,name:"Synthetic Owner",email:"ws-unit-owner@example.test",passwordHash:"synthetic-no-login",role:"ADMIN"},{id:other,name:"Synthetic Other",email:"ws-unit-other@example.test",passwordHash:"synthetic-no-login",role:"ADMIN"}]});
  await prisma.normalCustomer.create({data:{id:customer,normalizedTelephone:"+447700900081",telephoneNumber:"+447700900081"}});
  const data=[
   {externalId:"prior",status:"COMPLETED",bookedAtTime:new Date("2059-11-08T07:00:00Z"),completedAt:new Date("2059-11-08T08:00:00Z"),price:20,cost:15,normalCustomerId:customer},
   {externalId:"negative",status:"COMPLETED",completedAt:new Date("2059-11-10T09:00:00Z"),price:10,cost:12,normalCustomerId:customer},
   {externalId:"zero",status:"COMPLETED",completedAt:new Date("2059-11-10T09:30:00Z"),price:0,cost:0},
   {externalId:"unknown",status:"COMPLETED",completedAt:new Date("2059-11-10T10:00:00Z"),price:null,cost:4},
   {externalId:"cancelled",status:"CANCELLED",cancelledAt:new Date("2059-11-10T10:30:00Z"),price:999,cost:999},
   {externalId:"nofare",status:"NOFARE",noFareAt:new Date("2059-11-10T10:30:00Z"),price:888,cost:1},
  ];
  await prisma.booking.createMany({data:data.map(row=>({bookedAtTime:new Date("2059-11-10T08:00:00Z"),pickupDueTime:new Date("2059-11-10T08:30:00Z"),...row,provider,rawPayload:{synthetic:true}}))});
  const before=await prisma.booking.findMany({where:{provider},orderBy:{id:"asc"}});
  await t.test("partial receipts stay explicit; unknown margin is withheld; no-fare/cancelled money excluded",async()=>{const s=await workspaceSummary(["revenue","margin","completed","noFare","returning"],"TODAY",all,now);assert.equal(s.metrics.revenue?.value,10);assert.equal(s.metrics.revenue?.state,"PARTIAL");assert.equal(s.metrics.margin?.value,null);assert.equal(s.metrics.completed?.value,3);assert.equal(s.metrics.noFare?.value,1);assert.equal(s.metrics.returning?.value,1);});
  await t.test("negative and zero money remain real values; all-unknown prices are unavailable",async()=>{await prisma.booking.updateMany({where:{provider,externalId:"unknown"},data:{price:0,cost:0}});let s=await workspaceSummary(["revenue","margin"],"TODAY",all,now);assert.equal(s.metrics.margin?.value,-2);assert.equal(s.metrics.revenue?.value,10);await prisma.booking.updateMany({where:{provider,status:"COMPLETED",completedAt:{gte:new Date("2059-11-10T00:00:00Z")}},data:{price:null}});s=await workspaceSummary(["revenue"],"TODAY",all,now);assert.equal(s.metrics.revenue?.value,null);assert.equal(s.metrics.revenue?.state,"UNAVAILABLE");for(const row of before)await prisma.booking.update({where:{id:row.id},data:{price:row.price,cost:row.cost,updatedAt:row.updatedAt}});});
  await t.test("returning contacts include a repeat within the selected multi-day period",async()=>{const s=await workspaceSummary(["returning"],"LAST7",all,now);assert.equal(s.metrics.returning?.value,1);});
  await t.test("metric service rechecks card permissions",async()=>{const s=await workspaceSummary(["revenue","failed","completed"],"TODAY",p=>p==="bookings.view",now);assert.deepEqual(Object.keys(s.metrics),["completed"]);});
  await t.test("account storage preserves order and other user defaults",async()=>{const initial=await loadWorkspacePreference(owner,all);assert.equal(initial.revision,0);const cfg={...defaultConfig(all),widgets:["completed","booked"] as ("completed"|"booked")[]};const saved=await saveWorkspacePreference(owner,0,cfg);assert.equal(saved.revision,1);assert.deepEqual((await loadWorkspacePreference(owner,all)).config.widgets,["completed","booked"]);assert.equal((await loadWorkspacePreference(other,all)).revision,0);});
  await t.test("concurrent saves conflict without overwriting a newer layout",async()=>{const cfg=defaultConfig(all);const result=await Promise.allSettled([saveWorkspacePreference(owner,1,cfg),saveWorkspacePreference(owner,1,{...cfg,widgets:[]})]);assert.equal(result.filter(x=>x.status==="fulfilled").length,1);assert.equal(result.filter(x=>x.status==="rejected").length,1);assert.equal((await loadWorkspacePreference(owner,all)).revision,2);});
  assert.deepEqual(await prisma.booking.findMany({where:{provider},orderBy:{id:"asc"}}),before);
 }finally{await prisma.booking.deleteMany({where:{provider}});await prisma.normalCustomer.deleteMany({where:{id:customer}});await prisma.user.deleteMany({where:{id:{in:[owner,other]}}});await prisma.$disconnect();}
});
