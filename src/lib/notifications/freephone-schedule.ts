export type ActiveSchedule={activeStart:string;activeEnd:string;checkIntervalMinutes:number};
const timePattern=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
const london=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export function validateActiveSchedule(value:ActiveSchedule) {
 if(!value||!timePattern.test(value.activeStart)||!timePattern.test(value.activeEnd)||!Number.isSafeInteger(value.checkIntervalMinutes)||value.checkIntervalMinutes<5||value.checkIntervalMinutes>1440)throw new Error('Supply a valid active time and check interval from 5 to 1440 minutes.');return value;
}
function minutes(value:string){const [h,m]=value.split(':').map(Number);return h*60+m;}
export function inActiveWindow(date:Date,schedule:ActiveSchedule) {
 validateActiveSchedule(schedule);if(!Number.isFinite(date.getTime()))throw new Error('Invalid time.');
 const parts=london.formatToParts(date), h=Number(parts.find(x=>x.type==='hour')?.value),m=Number(parts.find(x=>x.type==='minute')?.value),now=h*60+m,start=minutes(schedule.activeStart),end=minutes(schedule.activeEnd);
 return start===end || (start<end?now>=start&&now<end:now>=start||now<end);
}
/** Next absolute instant aligned to the start of the London wall-clock window, including DST changes. */
export function nextActiveCheck(after:Date,schedule:ActiveSchedule) {
 validateActiveSchedule(schedule);if(!Number.isFinite(after.getTime()))throw new Error('Invalid time.');
 let t=Math.floor(after.getTime()/60000)*60000+60000;const start=minutes(schedule.activeStart);
 for(let i=0;i<4320;i++,t+=60000){const d=new Date(t);if(!inActiveWindow(d,schedule))continue;const p=london.formatToParts(d),m=Number(p.find(x=>x.type==='hour')?.value)*60+Number(p.find(x=>x.type==='minute')?.value);if(((m-start+1440)%1440)%schedule.checkIntervalMinutes===0)return d;}
 throw new Error('No monitoring time found.');
}
