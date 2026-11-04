import {processSharedReceipts,deliverSharedEvents} from '../src/lib/integrations/whatsapp/shared-worker';
import {sharedPool} from '../src/lib/integrations/whatsapp/shared';
async function main(){try{console.log('WHATSAPP_SHARED_WORKER',await processSharedReceipts(),await deliverSharedEvents());}catch{console.error('WHATSAPP_SHARED_WORKER_FAILED');process.exitCode=1;}finally{await sharedPool().end();}}void main();
