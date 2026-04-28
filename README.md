# Trading Platform Frontend

A trading dashboard SPA built with React 18, TypeScript, Vite, and TailwindCSS.

## Tech Stack

- **React 18** + **TypeScript** — UI and type safety
- **Vite** — dev server and build tool
- **TailwindCSS v3** — utility-first styling with a dark theme
- **React Router v6** — client-side SPA routing
- **Recharts** — chart components (available for future use)
- **Nginx** — static file serving in production (Cloud Run)

## Pages

| Route | Page |
|---|---|
| `/dashboard` | Portfolio stats overview |
| `/suggestions` | AI trade suggestions |
| `/history` | Trade history table |
| `/settings` | Broker configuration |

## Installation & Setup

```bash
npm install
cp .env.example .env       # edit VITE_API_URL if needed
npm run dev                # starts at http://localhost:5173
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `""` (empty) | Backend API base URL. Empty string means same origin (Nginx proxy). Set to `http://localhost:8080` for local dev. |

## Running the Project

```bash
npm run build              # outputs to dist/
npm run preview            # preview the production build locally
```

TypeScript type-check only (no emit):

```bash
npm run lint
```

## Docker

Build and run locally:

```bash
docker build -t trading-frontend .
docker run -p 8080:8080 trading-frontend
```

The container runs Nginx as a non-root user on port 8080 and serves the built SPA. All routes fall back to `index.html` for client-side routing.

A `/health` endpoint returns `200 ok` for Cloud Run health checks.

## Deployment

Push to the connected branch to trigger `cloudbuild.yaml`. The pipeline:

1. Builds the Docker image tagged with `$SHORT_SHA`
2. Pushes to Artifact Registry (`${_REGION}-docker.pkg.dev/${PROJECT_ID}/${_REPO}/${_SERVICE}`)
3. Deploys to Cloud Run (`${_SERVICE}` in `${_REGION}`)

Default substitutions (override in Cloud Build trigger settings):

| Variable | Default |
|---|---|
| `_REGION` | `us-central1` |
| `_REPO` | `trading-platform` |
| `_SERVICE` | `trading-frontend` |
