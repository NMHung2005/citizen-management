# System repair implementation plan

**Goal:** Repair the reported 35 TypeScript errors and confirmed API/configuration defects.

**Architecture:** Preserve the current Next.js monolith and schema's separation of accounts from household records. Reuse small authorization and booking-conflict helpers; use bcrypt for new passwords and upgrade legacy plaintext only after a successful login.

**Scope:** The user approved the findings in the immediately preceding diagnostic report. All changes stay inside this project; keep the four approved cleanup deletions. No commits, reset, deployment or data reset.

- [x] Reproduce runtime defects with real API tests against isolated SQLite; retain TypeScript diagnostics as the failing type regression check.
- [x] Fix type/configuration defects, remove obsolete jsPDF declarations, align existing user APIs with the current schema, and add ESLint/typecheck/test commands.
- [x] Add explicit role-aware authorization to unguarded APIs. Verify JWT signatures in middleware and require a configured secret. Hash all new/reset/seed passwords; retain safe legacy-login migration; retire password reveal.
- [x] Recheck booking conflicts during approval/payment inside a transaction. Test conflicting pending requests and adjacent time slots.
- [x] Persist and display avatars with an additive migration. Initialize the missing local environment/database without overwriting existing data or running destructive seed cleanup.
- [x] Run tests, lint, typecheck, Prisma migration/schema checks and production build. Review changes and document results.

## Review focus

- Account exports must exclude passwords and obsolete household fields.
- Missing, forged and expired tokens must not authorize protected routes.
- Legacy passwords must remain usable and be replaced with hashes after login.
- Conflicting approval/payment must leave booking and payment records unchanged.
- Avatar metadata must persist; unsupported uploads must be rejected.

## Evidence and decisions

- Baseline: 35 compiler errors in 18 files; schema and generated client match; no local database or environment file; ESLint lacks configuration.
- Ruling: work in the existing checkout, as requested, preserving user changes. The previous repair list is the approved scope; do not restore removed account-household functionality.
- Ruling: the local database was absent, then created and verified to have no tables. After applying four migrations, all application tables were explicitly confirmed empty before running sample seeds. No pre-existing records were cleared.
- Test evidence: initial 31 tests exposed 30 failures; final 35/35 pass. Additional regressions caught avatar response/preview gaps and a legacy-password upgrade/reset race, then verified the fixes.
- Final checks: TypeScript exits 0; ESLint exits 0 with eight nonblocking warnings (image optimization and hook dependencies); Prisma validate/status/schema diff pass; SQLite integrity and foreign keys pass; all five seeded accounts have bcrypt hashes.
- Production build exits 0 after approved network access for Google Fonts. A production HTTP smoke test passes login, four authenticated endpoints, unauthenticated API rejection and forged-token middleware rejection.
- Independent review findings were checked and corrected. No commits or deployment were performed.
