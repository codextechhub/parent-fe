/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The API base, `/v1` in development (proxied) and absolute in a build. */
  readonly VITE_BACKEND_URL: string;
  /** The domain schools are served under; `xvs.codexng.com` when unset. */
  readonly VITE_APP_BASE_DOMAIN?: string;
  /** The school to assume on a bare `localhost` in development only. */
  readonly VITE_DEV_SCHOOL_SLUG?: string;
  /** The API's CSRF cookie name where a deployment renames it; `csrftoken` when unset. */
  readonly VITE_CSRF_COOKIE_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
