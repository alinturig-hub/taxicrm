import { NextRequest, NextResponse } from 'next/server';
import { auditAuthorized } from '@/lib/internal-cron-auth';
import { prisma } from '@/lib/prisma';
import { generateDailyProfileSnapshots } from '@/lib/customers/generate-daily-profile-snapshots';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
 if(!auditAuthorized(request))return NextResponse.json({error:'UNAUTHORIZED'},{status:401});
 const [customers,last,partitions,metrics]=await Promise.all([prisma.normalCustomer.count(),prisma.normalCustomer.findFirst({orderBy:{id:'desc'},select:{id:true}}),prisma.$queryRaw<Array<{throughId:string}>>`SELECT max(id) AS "throughId" FROM (SELECT id,ntile(4) OVER(ORDER BY id) part FROM "NormalCustomer") customer_groups GROUP BY part ORDER BY part`,prisma.companyDailyMetric.findMany({orderBy:{date:"asc"},select:{date:true,revenue:true}})]);
 return NextResponse.json({customers,throughId:last?.id,partitions,metrics:metrics.map(m=>({date:m.date.toISOString().slice(0,10),revenue:m.revenue.toString()})),now:new Date().toISOString(),containsPersonalData:false},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:NextRequest){
 if(!auditAuthorized(request))return NextResponse.json({error:'UNAUTHORIZED'},{status:401});
 const b=await request.json().catch(()=>null);
 if(!b||!Number.isInteger(b.limit)||b.limit<1||b.limit>100||typeof b.throughId!=='string'||b.throughId.length>128||(b.afterId!==undefined&&(typeof b.afterId!=='string'||b.afterId.length>128)))return NextResponse.json({error:'INVALID_BATCH'},{status:400});
 try{
  const result=await generateDailyProfileSnapshots({scope:'all',limit:b.limit,afterId:b.afterId,throughId:b.throughId,skipExternal:true,refreshPredictions:true});
  return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'CUSTOMER_REBUILD_FAILED'},{status:503})}
}
