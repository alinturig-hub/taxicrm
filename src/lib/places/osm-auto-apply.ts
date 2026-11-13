import {isOsmReference,type OsmCandidate} from './osm-suggestions';
import {decideOsmAutoMatch} from './osm-auto-match';
type AutoPlace={status:string;id:string;placeName:string|null;category:string|null;isSensitive:boolean;poiCategoryStatus:string;poiCategorySource:string|null;updatedAt:Date};
type SafeDelegate={updateMany:(args:{where:{id:string;status:'READY';placeName:string;category:'other';isSensitive:false;poiCategoryStatus:'NO_MATCH';poiCategorySource:'AUTOMATIC_FALLBACK';updatedAt:Date};data:{category:string;categories:string[];poiCategoryStatus:'READY';poiCategorySource:'OSM_AUTO';poiCategoryProviderPlaceId:string;poiCategoryMatchDistanceMetres:number;poiCategoryEnrichedAt:Date;poiCategoryLastError:null;poiCategoryNextRetryAt:null}})=>Promise<{count:number}>};
const ALLOWED=new Set(['catering.pub','catering.bar','catering.restaurant','catering.restaurant.chinese','catering.cafe','catering.fast_food']);
/** Compare-and-set never replaces a manual edit or a record changed while the lookup ran. */
export async function applyOsmAutoMatch(delegate:SafeDelegate,place:AutoPlace,candidates:OsmCandidate[],now:Date){
 if(place.status!=='READY'||place.category!=='other'||place.isSensitive||place.poiCategoryStatus!=='NO_MATCH'||place.poiCategorySource!=='AUTOMATIC_FALLBACK'||!place.placeName)return {state:'SKIPPED' as const};
 const decision=decideOsmAutoMatch(place.placeName,candidates);if(decision.state!=='MATCH')return decision;
 const c=decision.candidate;if(!ALLOWED.has(c.category)||!isOsmReference(c.url))return {state:'SKIPPED' as const};
 const result=await delegate.updateMany({where:{id:place.id,status:'READY',placeName:place.placeName,category:'other',isSensitive:false,poiCategoryStatus:'NO_MATCH',poiCategorySource:'AUTOMATIC_FALLBACK',updatedAt:place.updatedAt},data:{category:c.category,categories:[c.category],poiCategoryStatus:'READY',poiCategorySource:'OSM_AUTO',poiCategoryProviderPlaceId:c.url,poiCategoryMatchDistanceMetres:c.distanceMetres,poiCategoryEnrichedAt:now,poiCategoryLastError:null,poiCategoryNextRetryAt:null}});
 return {state:result.count===1?'APPLIED' as const:'CHANGED' as const};
}
