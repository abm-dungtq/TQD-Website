# Documentation and validation

Read and update `docs/backup-restore.md` and backup references in
`docs/admin-agent-operations.md`; document the corrected Viral and analytics
contracts in their owning docs. Link machine-owned backup/restore table lists.
Show commands for gzip and encrypted backups without exposing secret values.

Run focused tests first, then `npm test`, `npm run build`, diff checks and an
independent code review. Resolve verified regressions, record actual results in
`reports/`, and mark the plan complete only after acceptance is verified.
No commit, remote write, restore or deployment is in scope.
