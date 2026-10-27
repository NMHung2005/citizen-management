# System repairs — 2026-10-27

## Scope

The repair addresses the reported TypeScript, configuration, authorization,
password storage, booking-conflict and avatar-persistence defects. It preserves
the current separation of accounts and resident/household records; obsolete user
household selections were removed rather than adding that relationship back.

## Authentication and passwords

- `JWT_SECRET` must be explicitly configured with at least 32 random characters.
  There is no default signing key. The local ignored `.env` was initialized with
  a random secret; do not commit or share it.
- Middleware verifies HS256 signatures and token expiration through jose.
- Previously unguarded APIs now verify identity, current account existence and
  applicable roles before accessing data.
- New, reset and seeded passwords use bcrypt. Valid legacy plaintext logins are
  migrated with a conditional update so a concurrent password reset takes
  precedence. `npm run db:hash-passwords` also upgrades existing stored passwords
  without changing the passwords people use to log in.
- Password reveal is retired. Its compatibility endpoint returns HTTP 410 to
  administrators without exposing a hash or plaintext. Use password reset.
- The old plaintext-conversion script name remains only as a compatibility entry
  point to the hash migration; it never converts hashes to plaintext.

## Database and avatars

- The missing local SQLite database was initialized from the committed migration
  history. Sample seed data was applied only after confirming every application
  table was empty. No existing database was reset.
- The new migration adds nullable `User.avatarUrl`. Uploads accept validated PNG,
  JPEG, GIF and WebP signatures and use generated filenames. Failed database
  writes remove the new upload instead of reporting false success.
- Both profile GET and PUT return the saved avatar URL. The settings view updates
  its preview immediately after upload and preserves it after saving a profile.

## Bookings

Booking creation, editing, approval and payment use transactions and the same
SQLite write lock when checking approved time slots. Approval/payment checks
exclude the booking being changed; adjacent time slots remain valid. Conflicts
return HTTP 409 and do not write payment or approval records. Payment confirmation
continues to be an application record, not automatic bank reconciliation.

## Development checks

```sh
npm run typecheck
npm run lint
npm test
npx prisma validate
npx prisma migrate status
npm run build
```

The API tests create their own SQLite database under ignored `.cache/tests/` and
remove it afterwards. They never seed or reset the application database.

The obsolete `@types/jspdf` package was removed; jsPDF supplies its own current
types. React hook-order errors exposed by enabling ESLint were also repaired.

## Verification results

- TypeScript: zero errors.
- API/security/concurrency tests: 35 passed.
- ESLint: zero errors, eight nonblocking image-optimization/hook-dependency warnings.
- Prisma: schema valid, migration history up to date, live database matches schema.
- SQLite: integrity check passes, no foreign-key violations.
- Production build: successful (font download required approved network access).
- Production HTTP smoke: login, four authenticated API reads, unauthenticated API
  rejection and forged-token middleware rejection all pass.
