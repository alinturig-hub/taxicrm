import type {OsmCandidate} from './osm-suggestions';
type Venue={name:string;category:string;latitude:number;longitude:number;osmType:'node'|'way';osmId:number};
type LocalIndex={version:1;source:'OpenStreetMap';sourceSha256:string;createdAt:string;venues:Venue[]};
const ALLOWED=new Set(['catering.pub','catering.bar','catering.restaurant','catering.restaurant.chinese','catering.cafe','catering.fast_food']);
const GRID=0.01;
const key=(lat:number,lon:number)=>`${Math.floor(lat/GRID)}:${Math.floor(lon/GRID)}`;
const rad=(value:number)=>value*Math.PI/180;
function metres(lat1:number,lon1:number,lat2:number,lon2:number){const h=Math.sin(rad(lat2-lat1)/2)**2+Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(rad(lon2-lon1)/2)**2;return 12742000*Math.asin(Math.sqrt(Math.min(1,h)))}
/** Validate the whole downloaded index before making any match; no partial imports. */
export function buildLocalVenueIndex(value:unknown){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('INVALID_OSM_INDEX');
 const data=value as Partial<LocalIndex>;
 if(data.version!==1||data.source!=='OpenStreetMap'||typeof data.sourceSha256!=='string'||!/^[a-f0-9]{64}$/.test(data.sourceSha256)||typeof data.createdAt!=='string'||!Number.isFinite(Date.parse(data.createdAt))||!Array.isArray(data.venues)||data.venues.length>2_000_000)throw Error('INVALID_OSM_INDEX');
 const cells=new Map<string,Venue[]>();
 for(const row of data.venues){
  if(!row||typeof row.name!=='string'||!row.name.trim()||row.name.length>120||/[\x00-\x1f\x7f]/.test(row.name)||!ALLOWED.has(row.category)||!Number.isFinite(row.latitude)||!Number.isFinite(row.longitude)||Math.abs(row.latitude)>85||Math.abs(row.longitude)>180||!['node','way'].includes(row.osmType)||!Number.isSafeInteger(row.osmId)||row.osmId<1)throw Error('INVALID_OSM_INDEX');
  const cell=key(row.latitude,row.longitude),list=cells.get(cell)??[];list.push(row);cells.set(cell,list);
 }
 return {sourceSha256:data.sourceSha256,createdAt:data.createdAt,venues:data.venues.length,findNearby(latitude:number,longitude:number):OsmCandidate[]{
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>85||Math.abs(longitude)>180)throw Error('INVALID_LOCATION');
  const latCell=Math.floor(latitude/GRID),lonCell=Math.floor(longitude/GRID),latRange=Math.ceil((50/110574)/GRID)+1,lonRange=Math.ceil((50/(111320*Math.cos(rad(latitude))))/GRID)+1;
  const result:OsmCandidate[]=[];
  for(let x=-latRange;x<=latRange;x++)for(let y=-lonRange;y<=lonRange;y++)for(const row of cells.get(`${latCell+x}:${lonCell+y}`)??[]){const d=metres(latitude,longitude,row.latitude,row.longitude);if(d<=50)result.push({name:row.name,category:row.category,distanceMetres:d,url:`https://www.openstreetmap.org/${row.osmType}/${row.osmId}`})}
  return result.sort((a,b)=>a.distanceMetres-b.distanceMetres);
 }};
}
