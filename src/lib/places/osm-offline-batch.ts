import {readFile,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {prisma} from '@/lib/prisma';
import {buildLocalVenueIndex} from './osm-local-index';
import {applyOsmAutoMatch} from './osm-auto-apply';
const JOB='OSM_OFFLINE_AUTO_V1';
const MAX_BATCH=100;
/** Disabled unless explicitly enabled; never calls any external service. */
export async function runOsmOfflineBatch(options:{now?:Date}={}){
 if(process.env.OSM_AUTO_ENABLED!=='true')return {state:'DISABLED' as const};
 const now=options.now??new Date(),path=join(process.cwd(),'data/osm/devon-venues.json');
 const info=await stat(path);if(info.size>5_000_000)throw Error('OSM_INDEX_TOO_LARGE');
 const raw=JSON.parse(await readFile(path,'utf8')) as Record<string,unknown>;
 if(typeof raw.sourceSnapshotDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(raw.sourceSnapshotDate))throw Error('OSM_INDEX_MISSING_SNAPSHOT_DATE');
 const snapshotDate=raw.sourceSnapshotDate;
 const snapshotTime=Date.parse(snapshotDate+'T00:00:00Z');
 if(!Number.isFinite(snapshotTime)||snapshotTime>now.getTime()||now.getTime()-snapshotTime>45*86400000)throw Error('OSM_INDEX_STALE');
 const index=buildLocalVenueIndex(raw);
 return prisma.$transaction(async tx=>{
  await tx.$executeRaw`SET LOCAL statement_timeout = '10s'`;
  const [lock]=await tx.$queryRaw<Array<{locked:boolean}>>`SELECT pg_try_advisory_xact_lock(187438603, 1) AS locked`;
  if(!lock.locked)return {state:'BUSY' as const};
  const prior=await tx.customerIntelligenceJobRun.findFirst({where:{jobKey:JOB,status:'SUCCEEDED'},orderBy:{startedAt:'desc'},select:{metadata:true}});
  const metadata=prior?.metadata&&typeof prior.metadata==='object'&&!Array.isArray(prior.metadata)?prior.metadata as Record<string,unknown>:{};
  const cursor=metadata.hash===index.sourceSha256&&typeof metadata.cursor==='string'?metadata.cursor:null;
  const places=await tx.placeIntelligence.findMany({where:{...(cursor?{id:{gt:cursor}}:{}),status:'READY',isSensitive:false,category:'other',poiCategoryStatus:'NO_MATCH',poiCategorySource:'AUTOMATIC_FALLBACK',placeName:{not:null}},orderBy:{id:'asc'},take:MAX_BATCH,select:{id:true,status:true,placeName:true,category:true,isSensitive:true,poiCategoryStatus:true,poiCategorySource:true,updatedAt:true,latitude:true,longitude:true}});
  let applied=0,review=0,changed=0;
  for(const place of places){const decision=await applyOsmAutoMatch(tx.placeIntelligence,place,index.findNearby(Number(place.latitude),Number(place.longitude)),now);if(decision.state==='APPLIED')applied++;else if(decision.state==='CHANGED')changed++;else review++}
  const next=places.length===MAX_BATCH?places[places.length-1].id:null;
  await tx.customerIntelligenceJobRun.create({data:{jobKey:JOB,status:'SUCCEEDED',source:'CRON',startedAt:now,finishedAt:new Date(),selected:places.length,processed:places.length,succeeded:applied,failed:0,hasMore:next!==null,metadata:{cursor:next,hash:index.sourceSha256,review,changed,snapshotDate}}});
  return {state:'COMPLETED' as const,selected:places.length,applied,review,changed,hasMore:next!==null,snapshotDate};
 },{timeout:20000,maxWait:3000});
}
