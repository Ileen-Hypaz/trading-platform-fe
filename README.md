# Trading Platform Frontend

A trading dashboard SPA built with React 18, TypeScript, Vite, and TailwindCSS.

## Tech Stack

- **React 18** + **TypeScript** — UI and type safety
- **Vite** — dev server and production build tool
- **TailwindCSS v3** — utility-first styling with a dark theme
- **React Router v6** — client-side SPA routing
- **Recharts** — price and indicator charts
- **Nginx 1.27** — static file serving in production (Cloud Run)

## Pages

| Route | Page |
|---|---|
| `/dashboard` | Portfolio overview, positions table, watchlist, price charts |
| `/suggestions` | AI-generated BUY/SELL/HOLD signals with confidence scores |
| `/history` | Paginated trade history |
| `/settings` | Auto-trading toggle, guardrail rule editor, activity log |

## Local Development

```bash
npm install
cp .env.example .env       # set VITE_API_URL=http://localhost:8080
npm run dev                # dev server at http://localhost:5173
```

The Vite dev server proxies all `/api` requests to `VITE_API_URL` (configured in `vite.config.ts`). Set `VITE_API_URL` to the URL of a running backend instance.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `""` (empty) | Backend API base URL. **Build-time only** — baked into the compiled JavaScript bundle by Vite. An empty value means same-origin requests, which works with the Nginx reverse proxy in production. Set to `http://localhost:8080` for local development. |

> **Build-time vs runtime**: Vite resolves `import.meta.env.VITE_*` variables at compile time, not at container startup. The value is frozen in the JS bundle produced by `npm run build`. Changing an environment variable on the running container has no effect — the variable must be set during `docker build` (via `--build-arg`) or before `npm run build`.

## Build

```bash
npm run build              # TypeScript type-check + Vite build → dist/
npm run preview            # preview the production build locally on port 4173
npm run lint               # TypeScript type-check only (no emit)
```

## Docker

Build with `VITE_API_URL` passed as a build argument:

```bash
# Cross-origin deployment (frontend and backend on different URLs):
docker build \
  --build-arg VITE_API_URL=https://trading-backend-<hash>-uc.a.run.app \
  -t trading-frontend .

# Same-origin / proxy deployment (Nginx or load balancer proxies /api to backend):
docker build -t trading-frontend .   # VITE_API_URL defaults to ""
```

Run locally:

```bash
docker run -p 8080:8080 trading-frontend
```

The container runs Nginx as a non-root user on port 8080. Client-side routing is handled via `try_files $uri $uri/ /index.html`. Static assets (JS, CSS, fonts, images) are served with a 1-year immutable `Cache-Control` header. A `/health` endpoint returns `200 ok` for Cloud Run health checks.

### Production API URL Strategy

`src/lib/api.ts` sets `BASE_URL = import.meta.env['VITE_API_URL'] ?? ''`. In production there are two patterns:

**Cross-origin deployment** (two independent Cloud Run services — recommended):

- Pass `VITE_API_URL=https://trading-backend-xxx-uc.a.run.app` at `docker build` time.
- API calls go directly from the browser to the backend Cloud Run URL.
- The backend `CORS_ORIGINS` env var must include the frontend Cloud Run URL.

**Same-origin / proxy deployment** (both services behind a single domain):

- Leave `VITE_API_URL` empty (the default).
- All `/api` fetch calls resolve against the frontend's origin.
- Requires an upstream reverse proxy (load balancer, Cloud Run ingress, or Nginx sidecar) to route `/api` traffic to the backend service.

## Deployment

Push to the trigger branch to start an automated deployment. `cloudbuild.yaml` will:

1. Build the Docker image tagged with `$SHORT_SHA`.
2. Push to `${_REGION}-docker.pkg.dev/${PROJECT_ID}/${_REPO}/${_SERVICE}:${SHORT_SHA}`.
3. Deploy to Cloud Run with `--allow-unauthenticated` (the dashboard is publicly accessible).

Default substitutions (override in Cloud Build trigger settings or via `--substitutions`):

| Variable | Default |
|---|---|
| `_REGION` | `us-central1` |
| `_REPO` | `trading-platform` |
| `_SERVICE` | `trading-frontend` |

### Passing `VITE_API_URL` Through Cloud Build

Add `--build-arg` to the Docker build step in `cloudbuild.yaml` and define a `_BACKEND_URL` substitution:

```yaml
substitutions:
  _REGION: us-central1
  _REPO: trading-platform
  _SERVICE: trading-frontend
  _BACKEND_URL: https://trading-backend-<hash>-uc.a.run.app

steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - build
      - '--build-arg'
      - 'VITE_API_URL=${_BACKEND_URL}'
      - '-t'
      - '${_REGION}-docker.pkg.dev/${PROJECT_ID}/${_REPO}/${_SERVICE}:${SHORT_SHA}'
      - '.'
    id: Build
```

The `Dockerfile` already declares `ARG VITE_API_URL` in the builder stage, so no Dockerfile changes are needed.

### Manual Trigger

```bash
gcloud builds submit . \
  --config=cloudbuild.yaml \
  --project="${PROJECT_ID}" \
  --substitutions="_REGION=us-central1,_REPO=trading-platform,_SERVICE=trading-frontend,_BACKEND_URL=https://trading-backend-xxx-uc.a.run.app"
```

### Nginx Configuration Notes

The included `nginx.conf`:

- Listens on port 8080 (Cloud Run's default port).
- Serves files from `/usr/share/nginx/html`.
- Falls back to `index.html` for all unmatched routes (required for client-side React Router).
- Enables gzip compression for text, JSON, and JavaScript responses over 1 KB.
- Sets `Cache-Control: public, immutable` with a 1-year expiry on all static assets (Vite generates content-hashed filenames, so stale cache is never served after a deployment).
- Exposes `/health` returning `200 ok` with no access log entry (used by Cloud Run health checks).
