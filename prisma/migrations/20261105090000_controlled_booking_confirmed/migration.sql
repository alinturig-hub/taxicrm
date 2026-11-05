-- Prepared only: never applied automatically by the controlled request handler.
CREATE TABLE "WhatsAppControlledDispatch"(
 scope text NOT NULL,operation_key text NOT NULL,request_hash text NOT NULL,intent jsonb NOT NULL CHECK(intent->>'booking_id' IS NOT NULL AND intent->>'booking_id'='autocab:SYNTHETIC-BC-53fd75f0-eb4d-4042-8ee6-92ebcc845f9d'),
 status text NOT NULL DEFAULT 'VALIDATING' CHECK(status IN ('VALIDATING','SENDING','BLOCKED','UNKNOWN','REJECTED','ACCEPTED','SENT','DELIVERED','READ','FAILED')),result jsonb,provider_message_id text,
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(scope,operation_key)
);
