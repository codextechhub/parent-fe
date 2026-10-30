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

Each environment (staging, then production) needs three things, in this
order.

### 1. A static site for this app

A Render **Static Site** per environment, from `codextechhub/parent-fe`, in
the My works project beside that environment's school-fe and student-fe
sites:

| Setting | Staging | Production |
| --- | --- | --- |
| Name | `xvs-parent-staging-fe` | `xvs-prod-parent` |
| Branch | `staging` | `production` |
| Build command | `npm ci && npm run build` | same |
| Publish directory | `dist` | same |
| `VITE_BACKEND_URL` | `https://api-staging.codexng.com/v1` | `https://api.codexng.com/v1` |
| `VITE_APP_BASE_DOMAIN` | `xvs-staging.codexng.com` | `xvs.codexng.com` |
| `VITE_CSRF_COOKIE_NAME` | `csrftoken_staging` | `csrftoken` |
| Auto-deploy | on commit | off (deployed by hand, as school-fe and student-fe are) |

The last three variables must match that environment's school-fe,
student-fe and API. The base domain is how the app reads the school off
its address: built without it, every staging address reads as "no school".
The cookie name is the API's `CSRF_COOKIE_NAME`; staging and production
share `.codexng.com`, so staging's has its own name.

Under **Redirects/Rewrites**, one rule: Rewrite `/*` to `/index.html`. A
file that exists is served first, so this only catches the app's own routes
on a refresh.

Under **Headers**: `Cache-Control: no-cache` on `/sw.js` and `/index.html`,
so a new version reaches phones on their next open, and
`Content-Type: application/manifest+json` on `/manifest.webmanifest`, which
Render otherwise sends as a plain download. Everything under `/assets/` is
named by its content and may be cached for good.

The security headers (HSTS, the content security policy, no framing) are the
same on all four sites and are listed once, in school-fe's
`docs/security-headers.md`. Add them here as well as on school-fe's site.

### 2. Two rules on school-fe's static site

On the **existing** school-fe static site of the same environment, under
**Redirects/Rewrites**, add these **above** its catch-all `/*` to
`/index.html` rule (rules run top to bottom, and the catch-all would
otherwise answer `/parent/` with school-fe's page):

| Type | Source | Destination |
| --- | --- | --- |
| Rewrite | `/parent/app/*` | `https://api-staging.codexng.com/v1/portal/parent/app/*` (production: `https://api.codexng.com/...`) |
| Rewrite | `/parent/*` | `https://xvs-parent-staging-fe.onrender.com/*` (production: `https://xvs-prod-parent.onrender.com/*`) |

The first passes the school's own manifest and crest icons through from the
API. The app asks for `/parent/app/<slug>/manifest.webmanifest` on its own
address (`src/lib/school-app.ts`); until that answers, the XVS manifest in
`dist/` stands in, so the app can always be installed. The second serves
this app: `/parent/fees` is fetched from the app's site as `/fees`, and its
own catch-all hands it `index.html`.

### 3. Push keys on the API

The same `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY` and
`WEB_PUSH_CONTACT` the student app relies on are already set on each
environment's backend web service and worker. The parent app reads the same
public key through the plain-user `GET /notifications/push/public-key/`
route (`src/redux/services/push-api.ts`), so no new keys are needed; without
them the Home card is not offered and nothing breaks. The one-off script
that mints a pair is in the student-fe README.

### Checking an environment

With `<school>` a real school's address on that environment:

1. `https://<school>/parent/` shows the sign-in page with the school's name,
   and `https://<school>/parent/fees` survives a refresh.
2. `curl -sI https://<school>/parent/sw.js` is JavaScript with
   `cache-control: no-cache`, not school-fe's HTML.
3. `curl -s https://<school>/parent/app/<slug>/manifest.webmanifest` is the
   school's manifest (its own `name`).
4. Signed in as a parent, Home offers Get the app (where the browser can
   install) and, once installed or on a desktop Chrome, Get notifications;
   turning them on and sending a parent a payment-received push brings one.

The dev server and `vite preview` follow the same `/parent/app/` rule
themselves (see `vite.config.ts`).
