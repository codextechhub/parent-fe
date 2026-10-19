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
- **One parent per browser.** A parent has one account on this app, not
  several children sharing an account the way student-fe does on a shared
  phone. **No per-device cookies here**: parents sign in through the ordinary
  tenant `/user/auth/login/`, the backend sets Django's refresh cookie and
  the short-lived access token lives in memory (`src/auth/access-token.ts`).
  A 401 asks `/user/auth/token/refresh/` once and retries; a second 401
  clears the session. The CSRF plumbing is the same as school-fe's. The
  child switcher in the header picks which child's record is showing; it
  does not switch accounts. The chosen child rides in the URL as `?child=`
  on per-child routes (Results, Attendance, Timetable, Assignments) and is
  dropped from family-scoped routes (Fees, Notices, Profile).
- **Auth and the shell share plumbing with school-fe.** `src/auth/csrf.ts`,
  `src/auth/refresh.ts` and the `/user/auth/` paths they call are the same
  the staff app uses. `src/components/shell/app-shell.tsx` is adapted from
  student-fe's and keeps the floating tab bar at every size. Keep those
  modules in step with their counterparts.
- **The route guard is `me/`.** `GET /v1/portal/parent/me/` is the one check
  that answers "is this account a parent at this school". 200 opens the
  shell; 404 is `NOT_A_PARENT` and sends the account back to sign-in with
  the staff-app message; 401 is a session expired and sends the parent back
  without a message. The platform tenant and any `device_app` answer on
  login are refused inline on sign-in: Codex staff and pupils never open
  the shell.
- **No school-fe hand-off yet.** school-fe's sign-in page already hands
  pupils to `/student/`; a parallel branch for parents to `/parent/` needs
  a backend `device_app` for guardians, which does not exist today. Parent
  sign-in works self-contained on this app's own `/parent/sign-in` page.
  Follow-up: add a parent policy to `vs_user.services.device_sessions`, then
  the symmetric branch in school-fe.
- **Phones are the main screen.** The layout is derived from the desktop
  design; the owner's choice between a desktop sidebar and the floating tab
  bar at every size is pending (see the plan). Horizontal page overflow is
  a bug.
- **Money comes from the API as kobo.** Never compute a balance the API can
  give; after a payment, read `fees/` again.

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
