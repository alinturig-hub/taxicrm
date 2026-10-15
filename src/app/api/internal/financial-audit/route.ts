import { auditAuthorized } from '@/lib/internal-cron-auth';
import { NextRequest, NextResponse } from 'next/server';
import { financialAudit } from '@/lib/revenue/financial-audit';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
 if(!auditAuthorized(request))return NextResponse.json({error:'UNAUTHORIZED'},{status:401});
 try{return NextResponse.json({checkedAt:new Date().toISOString(),businessTimezone:'Europe/London',basis:'MAX_COST_PRICE',containsPersonalData:false,rows:await financialAudit()},{headers:{'Cache-Control':'no-store'}})}
 catch{return NextResponse.json({error:'FINANCIAL_AUDIT_FAILED'},{status:503})}
}

/** Rebuild only explicitly supplied, bounded cached business days. */
export async function POST(request:NextRequest){
 if(!auditAuthorized(request))return NextResponse.json({error:'UNAUTHORIZED'},{status:401});
 const body=await request.json().catch(()=>null);
 if(!body||!Array.isArray(body.dates)||body.dates.length<1||body.dates.length>5||body.dates.some((d:unknown)=>typeof d!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d+'T12:00:00Z'))||new Date(d+'T12:00:00Z').toISOString().slice(0,10)!==d))return NextResponse.json({error:'INVALID_DATES'},{status:400});
 const {buildCompanyDailyMetrics}=await import('@/lib/analytics/build-company-daily-metrics');
 const result=[];
 for(const date of body.dates){const metric=await buildCompanyDailyMetrics(new Date(date+'T12:00:00Z'));result.push({date,revenue:metric.revenue.toString()})}
 return NextResponse.json({rebuilt:result.length,days:result});
}
