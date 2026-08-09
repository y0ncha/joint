# Recurring Transactions

Recurring schedules are household-owned templates for income or expenses. Creating one saves its first ledger entry immediately; a protected Vercel cron invokes the service-role-only database routine to create each later due entry.

Schedules retain an immutable anchor date and calculate weekly or monthly occurrences from that anchor, so month-end schedules clip to the final day without drifting. Generated rows link to their schedule and scheduled date under a unique database index; retries and catch-up runs therefore cannot create duplicates. A disabled or invalid template is paused rather than creating an uncategorized transaction.

The browser submits schedule creation and management through authenticated Server Actions. The cron route checks `CRON_SECRET` before constructing a server-only service-role client; neither credential is browser-visible. Existing category, payer, Bills-period, and shared-balance constraints remain authoritative.
