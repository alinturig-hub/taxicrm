import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bookingValue } from './booking-value';
import { calculateBookingRevenue } from './booking-revenue';
test('max Cost/Price preserves zeros, unknown and signed source values',()=>{
 for(const [price,cost,expected] of [[10,15,15],[20,4,20],[0,5,5],[0,null,0],[null,null,null],[null,12,12],[-5,-2,-2],[-5,null,-5],['',undefined,null],['invalid',8,8]] as const){
  const row={price,cost};const before=JSON.stringify(row);
  assert.equal(bookingValue(row),expected);assert.equal(JSON.stringify(row),before);
 }
});
test('completed and account no-fare revenue retain their recognition and waiting rules',()=>{
 assert.equal(calculateBookingRevenue({status:'COMPLETED',price:10,cost:15}),15);
 assert.equal(calculateBookingRevenue({status:'CANCELLED',price:10,cost:15}),0);
 const row={status:'NO_FARE',provider:'SYNTHETIC',accountId:'id1',price:10,cost:15,arrivedAt:new Date('2042-01-01T10:00:00Z'),noFareAt:new Date('2042-01-01T10:05:00Z')};
 assert.equal(calculateBookingRevenue(row,{provider:'SYNTHETIC',accountId:'id1',accountCode:'original',waitingChargeable:true,waitingRatePerMinute:2}),25);
});
