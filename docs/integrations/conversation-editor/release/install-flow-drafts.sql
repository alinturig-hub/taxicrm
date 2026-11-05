BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='20s';
CREATE TABLE public.whatsapp_flow_drafts (
 id uuid PRIMARY KEY,
 workspace text NOT NULL,
 name varchar(100) NOT NULL,
 version integer NOT NULL CHECK (version > 0),
 archived boolean NOT NULL DEFAULT false,
 created_by text NOT NULL,
 updated_by text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (workspace, id)
);
CREATE INDEX whatsapp_flow_drafts_workspace_updated ON public.whatsapp_flow_drafts(workspace, updated_at DESC, id);
CREATE TABLE public.whatsapp_flow_revisions (
 flow_id uuid NOT NULL REFERENCES public.whatsapp_flow_drafts(id) ON DELETE RESTRICT,
 version integer NOT NULL CHECK (version > 0),
 draft jsonb NOT NULL CHECK (jsonb_typeof(draft) = 'object' AND octet_length(draft::text) <= 131072),
 archived boolean NOT NULL,
 author_id text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (flow_id, version)
);

-- Only new editor tables. Do not change default ACLs or existing application objects.
REVOKE ALL ON public.whatsapp_flow_drafts, public.whatsapp_flow_revisions FROM taxicrm_shared_app;
GRANT SELECT, INSERT ON public.whatsapp_flow_drafts, public.whatsapp_flow_revisions TO taxicrm_shared_app;
GRANT UPDATE (name,version,archived,updated_by,updated_at) ON public.whatsapp_flow_drafts TO taxicrm_shared_app;
DO $$ BEGIN
 IF has_table_privilege('taxicrm_shared_app','public.whatsapp_flow_drafts','DELETE')
 OR has_table_privilege('taxicrm_shared_app','public.whatsapp_flow_revisions','UPDATE')
 OR has_table_privilege('taxicrm_shared_app','public.whatsapp_flow_revisions','DELETE') THEN
 RAISE EXCEPTION 'Unexpected inherited privilege on flow storage';
 END IF;
END $$;
COMMIT;
