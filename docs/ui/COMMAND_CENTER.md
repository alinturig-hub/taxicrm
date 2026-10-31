# Command Center first version

Route: /dashboard/command-center. Navigation: Today > Command Center.
Uses the existing session/administration permissions; dashboard.view is required.
Links are generated from the filtered workspace navigation. Counts use bounded
server-side aggregate queries, not loaded booking rows. No writes or migrations.
London midnight to render time defines the cohort. Completed count explicitly
requires COMPLETED status and completion timestamp. Each query can fail separately;
unavailable or unauthorized counts are never rendered as zero. Failed webhook count
is historical event status, not proof of an unresolved incident. Needs attention
links to the existing integration workspace for review. Snapshot updates on refresh.
No claim of agent availability, marketing readiness or overall system health is made.
Desktop uses decorative connection rings and module panels; mobile uses one-column
cards. The existing Today dashboard and Copilot remain unchanged.
