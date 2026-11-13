/** OpenStreetMap candidate mapping. A candidate is never applied without review. */
export type OsmCandidate={name:string;category:string;distanceMetres:number;url:string};
const rad=(x:number)=>x*Math.PI/180;
function distance(a:number,b:number,c:number,d:number){const h=Math.sin(rad(c-a)/2)**2+Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(rad(d-b)/2)**2;return 12742000*Math.asin(Math.sqrt(Math.min(1,h)))}
export function osmSuggestions(payload:unknown,latitude:number,longitude:number):OsmCandidate[]{
 if(!payload||typeof payload!=='object'||!('elements' in payload)||!Array.isArray(payload.elements))throw Error('INVALID_OSM_RESPONSE');
 const out:OsmCandidate[]=[];
 for(const item of payload.elements.slice(0,300)){
  if(!item||typeof item!=='object'||!['node','way','relation'].includes(item.type)||!Number.isSafeInteger(item.id)||item.id<1||!item.tags||typeof item.tags!=='object')continue;
  const tags=item.tags as Record<string,unknown>, name=typeof tags.name==='string'?tags.name.trim().slice(0,120):'';
  if(!name||/[\x00-\x1f\x7f]/.test(name))continue;
  const amenity=typeof tags.amenity==='string'?tags.amenity:'';
  const cuisine=typeof tags.cuisine==='string'?tags.cuisine.split(';').map(v=>v.trim().toLowerCase()):[];
  const category=amenity==='restaurant'&&cuisine.includes('chinese')?'catering.restaurant.chinese':({pub:'catering.pub',bar:'catering.bar',restaurant:'catering.restaurant',cafe:'catering.cafe',fast_food:'catering.fast_food'} as Record<string,string>)[amenity];
  if(!category)continue;
  const point=item.type==='node'?item:item.center;if(!point||typeof point.lat!=='number'||typeof point.lon!=='number'||!Number.isFinite(point.lat)||!Number.isFinite(point.lon)||Math.abs(point.lat)>90||Math.abs(point.lon)>180)continue;
  const metres=distance(latitude,longitude,point.lat,point.lon);if(metres>50)continue;
  out.push({name,category,distanceMetres:Math.round(metres),url:`https://www.openstreetmap.org/${item.type}/${item.id}`});
 }
 return out.sort((a,b)=>a.distanceMetres-b.distanceMetres).slice(0,10);
}
/** Reviewer-supplied provenance must point to a concrete OpenStreetMap object. */
export function isOsmReference(value:unknown):value is string {
 return typeof value==='string' && /^https:\/\/www\.openstreetmap\.org\/(node|way|relation)\/[1-9][0-9]{0,18}$/.test(value);
}
