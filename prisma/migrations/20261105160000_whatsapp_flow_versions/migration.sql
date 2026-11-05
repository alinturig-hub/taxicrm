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
