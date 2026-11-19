import { test } from 'node:test';import assert from 'node:assert/strict';
import {inActiveWindow,nextActiveCheck,validateActiveSchedule} from './freephone-schedule';
test('London active window and checks align to start across summer time',()=>{
 const s={activeStart:'06:00',activeEnd:'22:00',checkIntervalMinutes:60};
 assert.equal(inActiveWindow(new Date('2026-07-01T04:59:00Z'),s),false);
 assert.equal(nextActiveCheck(new Date('2026-07-01T04:59:00Z'),s).toISOString(),'2026-07-01T05:00:00.000Z');
 assert.equal(inActiveWindow(new Date('2026-07-01T21:00:00Z'),s),false);
 assert.equal(nextActiveCheck(new Date('2026-01-01T21:00:00Z'),s).toISOString(),'2026-01-02T06:00:00.000Z');
});
test('cross-midnight and full-day windows work, bad values rejected',()=>{
 const night={activeStart:'22:00',activeEnd:'06:00',checkIntervalMinutes:120};
 assert.equal(inActiveWindow(new Date('2026-01-02T02:00:00Z'),night),true);
 assert.equal(nextActiveCheck(new Date('2026-01-01T23:00:00Z'),night).toISOString(),'2026-01-02T00:00:00.000Z');
 assert.equal(inActiveWindow(new Date('2026-01-01T10:00:00Z'),{...night,activeStart:'00:00',activeEnd:'00:00'}),true);
 assert.throws(()=>validateActiveSchedule({...night,checkIntervalMinutes:0}));assert.throws(()=>validateActiveSchedule({...night,activeStart:'25:00'}));
});
test('London daylight-saving transitions use real instants',()=>{
 const s={activeStart:'00:00',activeEnd:'00:00',checkIntervalMinutes:60};
 assert.equal(nextActiveCheck(new Date('2026-03-29T00:00:00Z'),s).toISOString(),'2026-03-29T01:00:00.000Z');
 assert.equal(nextActiveCheck(new Date('2026-10-25T00:00:00Z'),s).toISOString(),'2026-10-25T01:00:00.000Z');
});
