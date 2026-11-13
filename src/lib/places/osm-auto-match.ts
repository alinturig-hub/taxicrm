import type {OsmCandidate} from './osm-suggestions';
export type AutoMatchDecision =
 | {state:'MATCH';candidate:OsmCandidate}
 | {state:'REVIEW';reason:'MISSING_NAME'|'GENERIC_NAME'|'NO_EXACT_MATCH'|'AMBIGUOUS'|'TOO_FAR'};
function normaliseName(value:string){return value.normalize('NFKC').toLocaleLowerCase('en-GB').replace(new RegExp('[^\\p{L}\\p{N}]+','gu'),' ').trim().replace(/\s+/g,' ')}
const GENERIC=new Set(['pub','bar','restaurant','cafe','coffee shop','fast food','takeaway','amenity','building','unknown','unnamed']);
/** A name alone is not proof: return a suggestion only for one exact, nearby named OSM object. */
export function decideOsmAutoMatch(placeName:string|null,candidates:OsmCandidate[]):AutoMatchDecision {
 if(!placeName||!placeName.trim())return {state:'REVIEW',reason:'MISSING_NAME'};
 const name=normaliseName(placeName);if(!name||GENERIC.has(name)||name.length<4)return {state:'REVIEW',reason:'GENERIC_NAME'};
 const matches=candidates.filter(candidate=>normaliseName(candidate.name)===name);
 if(matches.length===0)return {state:'REVIEW',reason:'NO_EXACT_MATCH'};
 if(matches.length!==1)return {state:'REVIEW',reason:'AMBIGUOUS'};
 const candidate=matches[0];
 if(!Number.isFinite(candidate.distanceMetres)||candidate.distanceMetres<0||candidate.distanceMetres>15)return {state:'REVIEW',reason:'TOO_FAR'};
 return {state:'MATCH',candidate};
}
