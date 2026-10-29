# Deployment guide

For this repository's single-service Render setup, see [the complete Render walkthrough](render.md). The production API can serve the built frontend when started from the repository root after building both applications.

No cloud resources have been created. Deployment requires explicit approval after reviewing the open acceptance items in PROGRESS.md.

Use Node 24 LTS. Build with `npm ci && npm run build`. Serve `apps/web/dist` through a same-origin reverse proxy with SPA fallback and `/api` forwarding. Run `node apps/api/dist/server.js` for the bundled API, or build the API image using `docker build -f infrastructure/docker/api.Dockerfile .`. The image runs as a non-root user. Configure the load balancer to forward health probes to `/health` and readiness probes to `/ready`.

For Azure, use Container Apps or App Service for the API and a suitable static/reverse-proxy frontend; for AWS, use ECS/App Runner plus a static frontend proxy. Use MongoDB Atlas or a managed replica set. Do not point production at the unauthenticated local Compose database. Use managed secrets for credentials and a high-entropy JWT secret, HTTPS, exact CORS origin, and Secure cookies. Deploy frontend and API same-site so SameSite=Strict refresh works. Configure CSP/HTTPS at the frontend host as well as Helmet on the API.

Environment: `NODE_ENV=production`; `PORT` defaults to 5000; `MONGODB_URI` is required; `WEB_ORIGIN` must be the exact HTTPS frontend origin; `JWT_SECRET` requires at least 48 random characters and must not use the example placeholder; `REFRESH_DAYS` is 1–30. `VITE_API_URL` can override `/api/v1` at frontend build time. Bootstrap values are CLI-only and should be removed from runtime environment after administrator creation.

The server handles SIGINT/SIGTERM and closes HTTP and MongoDB connections. Logs use Pino with credential/header redaction. Do not log reset links or secrets. Rate limiting is currently process-local; validate reverse-proxy trust and multi-instance limits before horizontal scaling.

Backups: enable managed point-in-time backups on Atlas, or use encrypted `mongodump --oplog` snapshots from a suitable replica member. Store backups outside the application account with limited access and retention. Test restores to a separate database with `mongorestore --oplogReplay`, then verify tenant counts, invoice balances, collections, and audit history before any cutover. Never test restore against the live production URI. Document and rehearse RPO/RTO before launch.
