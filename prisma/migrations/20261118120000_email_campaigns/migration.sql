-- CRM-owned email marketing records. Does not alter booking or customer tables.
CREATE TABLE email_templates (
 id uuid PRIMARY KEY, name text NOT NULL, subject text NOT NULL, body text NOT NULL,
 created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE email_campaigns (
 id uuid PRIMARY KEY, name text NOT NULL, subject text NOT NULL, body text NOT NULL,
 sender_email text NOT NULL, sender_name text NOT NULL, schedule_at timestamptz,
 timezone text NOT NULL DEFAULT 'Europe/London', status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SCHEDULED','PAUSED','CANCELLED','COMPLETED')),
 created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE email_campaign_recipients (
 id uuid PRIMARY KEY, campaign_id uuid NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
 address text NOT NULL, consent_evidence text NOT NULL, status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','CLAIMED','ACCEPTED','REJECTED','UNKNOWN','SUPPRESSED')),
 claimed_at timestamptz, provider_message_id text, UNIQUE(campaign_id, address)
);
CREATE TABLE email_suppressions (
 address text PRIMARY KEY, source text NOT NULL, reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE email_campaign_events (
 id uuid PRIMARY KEY, campaign_id uuid NOT NULL REFERENCES email_campaigns(id), recipient_id uuid REFERENCES email_campaign_recipients(id),
 event_type text NOT NULL, provider_event_id text UNIQUE, occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_campaign_due_idx ON email_campaigns (schedule_at) WHERE status = 'SCHEDULED';
CREATE INDEX email_campaign_recipient_status_idx ON email_campaign_recipients (campaign_id, status);
