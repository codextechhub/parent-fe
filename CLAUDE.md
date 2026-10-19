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
- **One parent per browser, usually.** A parent has one account on this app,
  not several children sharing an account the way the student app does on a
  shared phone. The child switcher in the header picks which child's record
  is showing in memory; it does not switch accounts. Nothing is cached per
  child yet in Phase 1 - that machinery lands with the per-child screens
  in Phase 4.
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
- Test parents will come from the backend's `seed_parent_portal_scenarios`
  once Phase 0 lands; the plan lists who signs in as whom.
- Releasing: `./deploy-staging.sh` puts main on staging; `./release.sh
  promote` moves staging to production with a version tag, `rollback <tag>`
  steps back. Both are student-fe's scripts, kept in step with them. Commit
  only to main.
