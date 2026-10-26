# CLAUDE.md - parent-fe

The XVS parent app: a parent's or guardian's own app, an installable PWA
served at the school's address under `/parent/`
(`bright-star.xvs.codexng.com/parent/`). The build plan, the owner's
decisions and what the API serves are in
`docs/parent-portal-design-phases.md`. Read it before building a screen; do
not re-ask a decision it records.

## The rules this app shares with school-fe

school-fe's `CLAUDE.md` is the house rulebook, and these parts of it apply
here word for word: **Field Access impact** reporting, **ship-check**,
**Wrapping up: report in plain words**, **Asking, suggesting and disputing:
use a real example**, **Fixing problems: root cause, not symptom**,
**Comments: short inline, the story in the doc block**, **Writing
punctuation** (no em dashes), **Vocabulary: it is a branch, never a
campus**, and **Brands** (this app is XVS: `SchoolMark` and `LoadingMark`,
the school's crest first, the XVS crest as the fallback, never the bare
CodeX mark).

`PageShell`, `PageHeader`, `ScrollArea`, `SchoolMark`, `LoadingMark` and
`src/index.css` are copies of school-fe's, which are copies of student-fe's.
Keep them in step: a fix to one belongs in all three.

### Vocabulary

**parent**, not "guardian", in UI copy: in the header, on buttons, in
sentences the parent reads. The backend keeps "guardian" where it names the
`StudentGuardian` model and its fields (that is a model name and travels
through the API that way). **children**, not "wards", for the people the
parent is signed in to see. These are what the design uses and what the FRD
calls them.

## What is different here

- **Everything lives under `/parent/`.** Vite's `base`, the router's
  `basename`, the manifest, the service worker's scope. school-fe owns the
  origin's root and student-fe owns `/student/`, so a root-relative address
  (`/svg/...`) would load another app's file. Use `import.meta.env.BASE_URL`
  for public assets.
- **One parent per browser, on a device session.** A parent has one account
  on this app, not several children sharing an account the way student-fe
  does on a shared phone. Sign-in is `POST /user/auth/login/` with
  `session: "device"`: it answers the access token and an `account` key, and
  puts the refresh credential in an HttpOnly cookie named for that account.
  The key is the only thing kept (`src/auth/device-account.ts`, behind an
  `AccountStorage` a store app swaps for secure storage); the short-lived
  access token lives in memory (`src/auth/access-token.ts`). A 401 asks
  `/user/auth/device/refresh/` `{account}` once and retries; 409
  `TOKEN_STALE` is retried once; a second 401 or a refresh refused 401
  clears the session. Sign-out is `/user/auth/device/sign-out/` `{account}`.
  An account the school offers no device session answers 403
  `DEVICE_SESSION_NOT_OFFERED`: not a parent here. The CSRF plumbing is the
  same as school-fe's. The child switcher in the header picks which child's
  record is showing; it does not switch accounts. The chosen child rides in
  the URL as `?child=` on per-child routes (Results, Attendance, Timetable,
  Assignments) and is dropped from family-scoped routes (Fees, Notices,
  Profile).
- **Auth and the shell share plumbing with school-fe.** `src/auth/csrf.ts`,
  `src/auth/refresh.ts` and the `/user/auth/device/` paths it calls are
  student-fe's. `src/components/shell/app-shell.tsx` is adapted from
  student-fe's and keeps the floating tab bar at every size. Keep those
  modules in step with their counterparts.
- **The route guard is `me/`.** `GET /v1/portal/parent/me/` is the one check
  that answers "is this account a parent at this school". 200 opens the
  shell; 404 is `NOT_A_PARENT` and sends the account back to sign-in with
  the staff-app message; 401 is a session expired and sends the parent back
  without a message. The platform tenant and a `DEVICE_SESSION_NOT_OFFERED`
  answer on login are refused inline on sign-in: Codex staff and other
  school staff never open the shell.
- **school-fe hands parents here.** A parent-only account that signs in,
  activates or resets its password on the school web app is answered a
  `device_app` of `/parent/`; school-fe moves the sign-in into this app's
  device session (`POST /user/auth/device/hand-over/`), leaves the account
  under sessionStorage `xvs.parent.handover` and opens `/parent/`.
  `adoptHandover` (`src/auth/device-account.ts`, called from `main.tsx`
  before the first render) adopts and removes it; the ordinary refresh then
  gets the access token from the cookie. The key name is school-fe's
  contract. Sign-in also works on this app's own `/parent/sign-in` page.
- **Phones are the main screen.** The layout is derived from the desktop
  design; the owner's choice between a desktop sidebar and the floating tab
  bar at every size is pending (see the plan). Horizontal page overflow is
  a bug.
- **Money comes from the API as kobo.** Never compute a balance the API can
  give; after a payment, read `fees/` again.

- **The store app is this app in a Capacitor shell.** Native code is additive,
  asks `isNativeApp()` (`src/native/platform.ts`) and nowhere else, and never
  changes the web behaviour. How it is built and what differs is in
  `docs/native-app.md`.

## Running it

- Use the arm64 Node (`node -p process.arch` says `arm64`); the Intel one at
  `/usr/local/bin/node` installs the wrong native tools.
- `npm run dev`, then open `http://lagoon-view.localhost:5176/parent/`. The
  school is read off the subdomain; a bare `localhost` shows "No school at
  this address". `/v1` is proxied to `localhost:8000`.
- The service worker is not registered by the dev server. To check it,
  `npm run build` then `npm run preview -- --port 4176` and open
  `http://lagoon-view.localhost:4176/parent/`.
- Before committing: `npx tsc -b`, `npx eslint . --max-warnings 0`,
  `npm test`, `npx vite build`. CI runs the same four.
- Test parents come from the backend's `seed_parent_portal_scenarios` (now
  shipped). On lagoon-view: `patricia.okafor@example.ng` with four children
  across both branches, password `Parent@School2026`.
- Releasing: `./deploy-staging.sh` puts main on staging; `./release.sh
  promote` moves staging to production with a version tag, `rollback <tag>`
  steps back. Both are student-fe's scripts, kept in step with them. Commit
  only to main.
