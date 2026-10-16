import { auditAuthorized } from '@/lib/internal-cron-auth';
import { NextRequest, NextResponse } from 'next/server';
import { financialAudit } from '@/lib/revenue/financial-audit';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
 if(!auditAuthorized(request))return NextResponse.json({error:'UNAUTHORIZED'},{status:401});
 if(request.nextUrl.searchParams.has('external')){
  const {externalBookingComparison,externalComparisonModes}=await import('@/lib/revenue/external-booking-comparison');
  const mode=request.nextUrl.searchParams.get('external'),cursor=request.nextUrl.searchParams.get('afterId'),through=request.nextUrl.searchParams.get('throughId');
  if(!externalComparisonModes.some(m=>m===mode)||[cursor,through].some(v=>v!==null&&(!v.trim()||v.length>128)))return NextResponse.json({error:'INVALID_EXTERNAL_COMPARISON'},{status:400});
  try{return NextResponse.json(await externalBookingComparison(mode as typeof externalComparisonModes[number],cursor,through),{headers:{'Cache-Control':'no-store'}})}catch{return NextResponse.json({error:'EXTERNAL_COMPARISON_FAILED'},{status:503})}
 }
 if(request.nextUrl.searchParams.has('compare')){
  const {bookingImportComparison,importComparisonModes}=await import('@/lib/revenue/booking-import-comparison');
  const mode=request.nextUrl.searchParams.get('compare');
  if(!importComparisonModes.some(m=>m===mode))return NextResponse.json({error:'INVALID_COMPARISON'},{status:400});
  try{return NextResponse.json({checkedAt:new Date().toISOString(),readOnly:true,containsCustomerContacts:false,rows:await bookingImportComparison(mode as typeof importComparisonModes[number],null,request.nextUrl.searchParams.get('table'))},{headers:{'Cache-Control':'no-store'}})}catch{return NextResponse.json({error:'IMPORT_COMPARISON_FAILED'},{status:503})}
 }
 if(request.nextUrl.searchParams.get('cohort')==='missing-completed'){
  try{const {missingCompletedCohort}=await import('@/lib/revenue/missing-amount-cohort');return NextResponse.json({checkedAt:new Date().toISOString(),readOnly:true,containsPersonalData:false,rows:await missingCompletedCohort()},{headers:{'Cache-Control':'no-store'}})}catch{return NextResponse.json({error:'COHORT_AUDIT_FAILED'},{status:503})}
 }
 if(request.nextUrl.searchParams.get('reconcile')==='1'){
  const cursor=request.nextUrl.searchParams.get('afterId');
  if(cursor!==null&&(cursor.length>128||!cursor.trim()))return NextResponse.json({error:'INVALID_CURSOR'},{status:400});
  try{const {missingAmountReconciliation}=await import('@/lib/revenue/missing-amount-reconciliation');return NextResponse.json(await missingAmountReconciliation(cursor),{headers:{'Cache-Control':'no-store'}})}catch{return NextResponse.json({error:'RECONCILIATION_FAILED'},{status:503})}
 }
 if(request.nextUrl.searchParams.get('missing')==='1'){
  const cursor=request.nextUrl.searchParams.get('afterId');
  if(cursor!==null&&(cursor.length>128||!cursor.trim()))return NextResponse.json({error:'INVALID_CURSOR'},{status:400});
  try{const {missingAmountAudit}=await import('@/lib/revenue/missing-amount-audit');return NextResponse.json(await missingAmountAudit(cursor,request.nextUrl.searchParams.get('history')==='1',null,request.nextUrl.searchParams.get('historyOnly')==='1'),{headers:{'Cache-Control':'no-store'}})}catch{return NextResponse.json({error:'MISSING_AMOUNT_AUDIT_FAILED'},{status:503})}
 }
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
