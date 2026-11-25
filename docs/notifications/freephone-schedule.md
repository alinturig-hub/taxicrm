# Freephone monitoring

The Orion SMS gateway is configured under Integrations / Communication. Freephone monitoring and recent SMS checks are under Operations / Notifications; existing API endpoints and stored jobs are retained. No migration or automatic source reconfiguration is required.

A rule can use a 1–168 hour inactivity period, a 5–1440 minute check frequency and a London-time active window. Start is inclusive, end exclusive; equal times mean all day. The first check occurs no earlier than a complete inactivity window after activating or changing the schedule. Night windows and daylight-saving changes are evaluated as London wall time. Outside the window, checks and queued alerts wait until the next eligible check. SMS data is checked again before a custom-schedule inactivity message is sent; if bookings resumed the queued message is cancelled, and if booking evidence is incomplete it is deferred.

Existing jobs without custom schedules keep their previous 12/24-hour behavior. One alert is generated for a continuous inactivity episode and rearmed after a booking appears. Provider acceptance is not handset delivery. A line must be mapped to a source field known to identify the freephone, not presumed to be the caller's number. An inactive or interrupted source feed can still produce misleading absence-of-booking evidence.

Messages support existing `{freephone}`, `{count}`, `{period}`, `{threshold}`, plus `{{Name}}`, `{{Location}}` (workflow name) and `{{Phone}}` (monitored source value). The destination is the separately configured SMS recipient. No real SMS is sent during tests.

When a prior alert is active, the custom schedule also checks for recorded bookings since the previous alert check. This rearms the monitor if a booking arrived between checks but has already left the shorter inactivity lookback; a new alert is sent only if the latest inactivity window is again empty.

## Freephone lines and Copilot

Operations → Notifications accepts manual lines and CSV files with the columns `Location Name,Phone Number` (up to 25 rows per file). Preview reports invalid rows and duplicate UK numbers across the file and existing lines. Import accepts the ready rows and creates disabled lines. The enable/disable control preserves alert settings. Enabling still requires verified booking evidence, a recipient and an active event. Disabling cancels pending and retry messages for the workflow.

Copilot uses the same line records, including lines with alerts disabled. It requires access to Copilot, booking data and Notifications. When an approved Ollama connection is available, Copilot asks it to extract the location and period. TaxiCRM checks that interpretation against the question and computes the count in a read-only transaction. Ambiguous names and unsupported filters remain unverified. Supported periods are today, yesterday, this week, last week, this month and last month, in Europe/London.

Copilot can use a dedicated `TAXICRM_COPILOT_OLLAMA_URL` with optional `TAXICRM_COPILOT_OLLAMA_MODEL`, the approved Owner Agent Ollama connection, or the existing local Email AI Ollama configuration. The model origin must be in `TAXICRM_AGENT_OLLAMA_ORIGINS`. If Ollama is unavailable, supported question forms still use the validated deterministic filter.
