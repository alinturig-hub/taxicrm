# Freephone monitoring

The Orion SMS gateway is configured under Integrations / Communication. Freephone monitoring and recent SMS checks are under Operations / Notifications; existing API endpoints and stored jobs are retained. No migration or automatic source reconfiguration is required.

A rule can use a 1–168 hour inactivity period, a 5–1440 minute check frequency and a London-time active window. Start is inclusive, end exclusive; equal times mean all day. The first check occurs no earlier than a complete inactivity window after activating or changing the schedule. Night windows and daylight-saving changes are evaluated as London wall time. Outside the window, checks and queued alerts wait until the next eligible check. SMS data is checked again before a custom-schedule inactivity message is sent; if bookings resumed the queued message is cancelled, and if booking evidence is incomplete it is deferred.

Existing jobs without custom schedules keep their previous 12/24-hour behavior. One alert is generated for a continuous inactivity episode and rearmed after a booking appears. Provider acceptance is not handset delivery. A line must be mapped to a source field known to identify the freephone, not presumed to be the caller's number. An inactive or interrupted source feed can still produce misleading absence-of-booking evidence.

Messages support existing `{freephone}`, `{count}`, `{period}`, `{threshold}`, plus `{{Name}}`, `{{Location}}` (workflow name) and `{{Phone}}` (monitored source value). The destination is the separately configured SMS recipient. No real SMS is sent during tests.

When a prior alert is active, the custom schedule also checks for recorded bookings since the previous alert check. This rearms the monitor if a booking arrived between checks but has already left the shorter inactivity lookback; a new alert is sent only if the latest inactivity window is again empty.
