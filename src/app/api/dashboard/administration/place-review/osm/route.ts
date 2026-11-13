import {getServerSession} from 'next-auth';
import {NextResponse} from 'next/server';
import {authOptions} from '@/lib/auth';
import {requireAdministrationPermission} from '@/lib/administration-access';
import {prisma} from '@/lib/prisma';
import {osmSuggestions} from '@/lib/places/osm-suggestions';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
let nextRequestAt=0;
export async function POST(request:Request){
 const user=await requireAdministrationPermission((await getServerSession(authOptions))?.user?.email,'configuration.manage');
 if(!user)return NextResponse.json({error:'FORBIDDEN'},{status:403,headers});
 if(request.headers.get('origin')!==new URL(process.env.NEXTAUTH_URL||request.url).origin)return NextResponse.json({error:'ORIGIN_REQUIRED'},{status:403,headers});
 let id:string;try{const text=await request.text();if(Buffer.byteLength(text)>1024)throw Error();const body=JSON.parse(text);if(!body||Object.keys(body).join(',')!=='id'||typeof body.id!=='string'||!/^c[a-z0-9]{5,80}$/i.test(body.id))throw Error();id=body.id}catch{return NextResponse.json({error:'INVALID_REQUEST'},{status:400,headers})}
 const place=await prisma.placeIntelligence.findUnique({where:{id},select:{category:true,isSensitive:true,poiCategoryStatus:true,latitude:true,longitude:true}});
 if(!place||place.category!=='amenity'||place.isSensitive||place.poiCategoryStatus==='SKIPPED_SENSITIVE')return NextResponse.json({error:'PLACE_NOT_AVAILABLE'},{status:404,headers});
 const latitude=Number(place.latitude),longitude=Number(place.longitude);
 if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)return NextResponse.json({error:'INVALID_LOCATION'},{status:400,headers});
 if(Date.now()<nextRequestAt)return NextResponse.json({error:'WAIT_BEFORE_RETRY'},{status:429,headers});
 nextRequestAt=Date.now()+5000;
 const query=`[out:json][timeout:8];(nwr["amenity"~"^(pub|bar|restaurant|cafe|fast_food)$"](around:50,${latitude},${longitude}););out center 300;`;
 try{
  const response=await fetch('https://ovp.dresel.systems/api/interpreter',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'TaxiCRM-PlaceReview/1.0'},body:new URLSearchParams({data:query}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)});
  if(!response.ok||!response.body)return NextResponse.json({error:'OSM_UNAVAILABLE'},{status:503,headers});
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1048576){await reader.cancel();return NextResponse.json({error:'OSM_RESPONSE_TOO_LARGE'},{status:502,headers})}chunks.push(value)}
  const suggestions=osmSuggestions(JSON.parse(Buffer.concat(chunks).toString('utf8')),latitude,longitude);
  return NextResponse.json({suggestions},{headers});
 }catch{return NextResponse.json({error:'OSM_UNAVAILABLE'},{status:503,headers})}
}
