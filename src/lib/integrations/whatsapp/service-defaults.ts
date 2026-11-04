import type {PoolClient} from 'pg';
import drafts from '../../../../docs/integrations/whatsapp-service-template-drafts.json';
/** Seed disabled bindings only; never overwrite an operator's chosen template or enable sending. */
export async function seedServiceBindings(db:PoolClient,scope:string){
 for(const d of drafts)await db.query(`INSERT INTO "WhatsAppTemplateBinding" (scope,milestone,name,language,"parameterKeys",enabled,"updatedBy") VALUES($1,$2,$3,$4,$5::jsonb,false,'setup:defaults') ON CONFLICT(scope,milestone) DO NOTHING`,[scope,d.milestone,d.name,d.language,JSON.stringify(d.parameterKeys)]);
}
