import {prisma} from '@/lib/prisma';
/** Recent records in the shared database; these timestamps are not a source health check. */
export async function sharedActivity(){
 return prisma.$transaction(async tx=>{
  await tx.$executeRaw`SET LOCAL statement_timeout = '3000ms'`;
  await tx.$executeRaw`SET TRANSACTION READ ONLY`;
  const [event,tracking,driver]=await Promise.all([
   tx.webhookEvent.findFirst({where:{provider:'AUTOCAB'},orderBy:{receivedAt:'desc'},select:{receivedAt:true}}),
   tx.vehicleSnapshot.findFirst({where:{provider:'AUTOCAB'},orderBy:{snapshotAt:'desc'},select:{snapshotAt:true}}),
   tx.driver.findFirst({where:{provider:'AUTOCAB',lastApiSyncAt:{not:null}},orderBy:{lastApiSyncAt:'desc'},select:{lastApiSyncAt:true}}),
  ]);
  return {eventAt:event?.receivedAt??null,trackingAt:tracking?.snapshotAt??null,driverSyncAt:driver?.lastApiSyncAt??null};
 },{timeout:5000});
}
