# XVS Parent

A parent's or guardian's own app: their children's classes, results,
attendance, notices, fees and paying, on a phone as an installed app. Served
at a school's address under `/parent/`.

```bash
npm install
npm run dev
```

Then open `http://lagoon-view.localhost:5176/parent/` (the school is read off
the subdomain). See `CLAUDE.md` for how the app is built and
`docs/parent-portal-design-phases.md` for the plan.

## Releasing

Three branches, as in school-fe and student-fe:

- `main` is where work is committed. CI checks every push to it.
- `staging` is `main`, put there by `./deploy-staging.sh` (reset and
  force-pushed); the host deploys it on its own. Nobody commits to it.
- `production` only moves forward. `./release.sh promote [patch|minor|major]`
  fast-forwards it to staging's tip and tags the release (`v1.0.0` first);
  `./release.sh rollback <tag>` adds a commit carrying that release's files.
  `./release.sh status` shows where the three stand. Production is deployed by
  hand from the host after the branch moves.

## Hosting

The app is served on each school's own address under `/parent/`, beside
school-fe and student-fe on the same origin
(`bright-star.xvs.codexng.com/parent/`). All three are Render static sites
behind Cloudflare. Render's rules match paths only, never the host, so
nothing here depends on knowing which school was asked for: the app works
that out itself and names the school in the path.

Each environment (staging, then production) needs the same three things the
student app lays down, scaled over `/parent/*` and
`/parent/manifest.webmanifest`. The full write-up lives in student-fe's
README and belongs here once Phase 7 ships; the sections below are
placeholders for that.

### 1. A static site for this app

A Render **Static Site** per environment, from `codextechhub/parent-fe`, in
the My works project beside that environment's school-fe and student-fe
sites. See the student-fe README for the exact environment variables, the
`VITE_BACKEND_URL` / `VITE_APP_BASE_DOMAIN` / `VITE_CSRF_COOKIE_NAME` set,
the `Rewrite /*` catch-all, and the headers for `sw.js`, `index.html`,
`manifest.webmanifest` and `/assets/`.

### 2. Two rules on school-fe's static site

On school-fe's static site of the same environment, add these **above** its
catch-all `/*` to `/index.html` rule:

| Type | Source | Destination |
| --- | --- | --- |
| Rewrite | `/parent/app/*` | `https://api-staging.codexng.com/v1/portal/parent/app/*` (production: `https://api.codexng.com/...`) |
| Rewrite | `/parent/*` | the parent-fe static site's `*` on the same environment |

The first passes the school's own manifest and crest icons through from the
API. The app asks for `/parent/app/<slug>/manifest.webmanifest` on its own
address (`src/lib/school-app.ts`); until that answers, the XVS manifest in
`dist/` stands in, so the app can always be installed. The second serves this
app.

### 3. `PARENT_APP_BASE_URL` on the API

Phase 7. The backend's card checkout returns to `/parent/fees/paid`, and
`PARENT_APP_BASE_URL` names which host that is per environment.

### Checking an environment

With `<school>` a real school's address on that environment:

1. `https://<school>/parent/` shows the sign-in page with the school's name,
   and `https://<school>/parent/fees` survives a refresh.
2. `curl -sI https://<school>/parent/sw.js` is JavaScript with
   `cache-control: no-cache`, not school-fe's HTML.
3. `curl -s https://<school>/parent/app/<slug>/manifest.webmanifest` is the
   school's manifest (its own `name`).

The dev server and `vite preview` follow the same `/parent/app/` rule
themselves (see `vite.config.ts`).
