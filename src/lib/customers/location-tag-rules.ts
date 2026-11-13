/** Configurable place rules operate on evidence, never on inferred personal preferences. */
export type LocationTagRule = {
 id:string; name:string; enabled:boolean; placeType:'pub'|'restaurant'|'chinese_restaurant';
 windowDays:number; minimumMatches:number; minimumPercent:number;
};
export type LocationJourney = {
 status:string; pickupDueTime:Date|null;
 locations:Array<{type:'PICKUP'|'DESTINATION';placeIntelligence?:{isSensitive:boolean;poiCategoryStatus?:string;category:string|null;categories?:unknown}|null}>;
};
const categories:Record<LocationTagRule['placeType'],string[]>={pub:['catering.pub','catering.bar'],restaurant:['catering.restaurant'],chinese_restaurant:['catering.restaurant.chinese']};
export function validateLocationRule(value:unknown):LocationTagRule {
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid location rule');
 const v=value as Record<string,unknown>;
 if(Object.keys(v).sort().join(',')!=='enabled,id,minimumMatches,minimumPercent,name,placeType,windowDays'||typeof v.id!=='string'||!/^CUSTOM_PLACE_[A-Z0-9_]{1,50}$/.test(v.id)||typeof v.name!=='string'||!v.name.trim()||v.name.trim().length>60||typeof v.enabled!=='boolean'||!['pub','restaurant','chinese_restaurant'].includes(String(v.placeType))||!Number.isInteger(v.windowDays)||Number(v.windowDays)<1||Number(v.windowDays)>90||!Number.isInteger(v.minimumMatches)||Number(v.minimumMatches)<1||Number(v.minimumMatches)>1000||typeof v.minimumPercent!=='number'||!Number.isFinite(v.minimumPercent)||v.minimumPercent<0||v.minimumPercent>100)throw Error('Invalid location rule');
 return {...v,name:v.name.trim()} as LocationTagRule;
}
export function evaluateLocationRule(rule:LocationTagRule,bookings:LocationJourney[],now:Date){
 if(!rule.enabled)return {matched:0,eligible:0,percent:null,qualifies:false,lastMatchedAt:null};
 const end=now.getTime(),start=end-rule.windowDays*86400000;
 const eligible=bookings.filter(b=>b.status.toUpperCase()==='COMPLETED'&&b.pickupDueTime&&b.pickupDueTime.getTime()>=start&&b.pickupDueTime.getTime()<=end&&b.locations.some(l=>l.type==='DESTINATION'&&l.placeIntelligence&&!l.placeIntelligence.isSensitive&&l.placeIntelligence.poiCategoryStatus==='READY'&&(!!l.placeIntelligence.category||(Array.isArray(l.placeIntelligence.categories)&&l.placeIntelligence.categories.some(v=>typeof v==='string'&&v.length>0)))));
 const matched=eligible.filter(b=>b.locations.some(l=>{
  const p=l.placeIntelligence;if(l.type!=='DESTINATION'||!p||p.isSensitive||p.poiCategoryStatus!=='READY')return false;
  const values=[p.category,...(Array.isArray(p.categories)?p.categories:[])].filter((v):v is string=>typeof v==='string');
  return values.some(v=>categories[rule.placeType].some(prefix=>v===prefix||v.startsWith(prefix+'.')));
 }));
 const percent=eligible.length?Math.round(matched.length/eligible.length*1000)/10:null;
 return {matched:matched.length,eligible:eligible.length,percent,qualifies:matched.length>=rule.minimumMatches&&percent!==null&&percent>=rule.minimumPercent,lastMatchedAt:matched.reduce<string|null>((latest,b)=>{const value=b.pickupDueTime!.toISOString();return !latest||value>latest?value:latest},null)};
}

export function parseLocationRules(value:unknown):LocationTagRule[]{
 if(!Array.isArray(value)||value.length>20)throw Error('Use at most 20 location rules.');
 const seen=new Set<string>();return value.map(item=>{const rule=validateLocationRule(item);if(seen.has(rule.id))throw Error('Duplicate location rule ID.');seen.add(rule.id);return rule});
}
