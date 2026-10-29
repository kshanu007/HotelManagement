# Deploy to Render

Use one Node web service for the API and the built React frontend. The production API serves `apps/web/dist` and falls back to its index page for browser routes. API paths retain JSON responses. This keeps authentication cookies and API requests on the same origin. No separate static site or Docker service is needed for this setup.

## 1. Push the prepared code

From the repository root:

```powershell
git add apps/api/src/app.ts apps/api/src/config/env.ts .env.example docs/deployment PROGRESS.md
git commit -m "Prepare same-origin Render deployment"
git push origin main
```

Complete GitHub authentication if Git prompts. Do not add `.env`. Confirm the latest commit exists in GitHub before creating the service.

## 2. Prepare MongoDB Atlas

Use the Atlas replica-set connection URI for the desired database, for example `mongodb+srv://USER:ENCODED_PASSWORD@CLUSTER.mongodb.net/annapurna?retryWrites=true&w=majority`. Replace every placeholder. Percent-encode reserved characters in the database user's password. Atlas Database Access credentials are separate from the app's admin and owner logins.

Using the existing database preserves its current accounts and business records. A new database starts empty and needs account setup. Atlas must permit the Render service's outbound IP ranges under Security / Network Access. The service's Connect / Outbound section lists those ranges; add all applicable ranges. Do not leave unrestricted network access enabled as a deployment shortcut.

## 3. Create a Render web service

Sign in at https://dashboard.render.com. Select New / Web Service, connect GitHub, and select `kshanu007/HotelManagement`. Grant the Render GitHub integration access if the repository is missing.

| Setting           | Value                                                |
| ----------------- | ---------------------------------------------------- |
| Name              | An available name, for example `annapurna-hotel`     |
| Branch            | `main`                                               |
| Runtime           | Node                                                 |
| Root directory    | Leave blank (repository root)                        |
| Build command     | `npm ci --include=dev && npm run build`              |
| Start command     | `node apps/api/dist/server.js`                       |
| Health check path | `/ready`                                             |
| Region            | Prefer a region close to the Atlas cluster and users |

Choose a paid instance for production. Free instances are suitable for a trial and sleep after inactivity; review Render's current plan limits before choosing.

## 4. Set environment variables

Use the real Render service URL for WEB_ORIGIN. `https://annapurna-hotel.onrender.com` below is only an example. If Render assigns another hostname, change WEB_ORIGIN to match it exactly and redeploy. Use HTTPS and omit the trailing slash.

| Variable         | Value                                                                 |
| ---------------- | --------------------------------------------------------------------- |
| NODE_ENV         | `production`                                                          |
| NODE_VERSION     | `24`                                                                  |
| PORT             | `10000`                                                               |
| TRUST_PROXY_HOPS | `1` for the standard Render proxy; review if adding another proxy/CDN |
| MONGODB_URI      | Your Atlas connection string, including the intended database name    |
| WEB_ORIGIN       | Your exact public HTTPS service origin                                |
| JWT_SECRET       | A new random secret of at least 48 characters                         |
| REFRESH_DAYS     | `7`                                                                   |
| VITE_API_URL     | `/api/v1`                                                             |

Generate JWT_SECRET locally:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Paste it privately into Render. VITE_API_URL is public frontend configuration; the other values remain server-side. API_PROXY_TARGET is only for the local Vite development server and is not needed here. Never prefix secrets with VITE_. Bootstrap/demo values are unnecessary when using the existing database, and changing those variables does not change existing accounts.

## 5. Deploy and allow Atlas access

Select Deploy Web Service. Watch the build logs and then the runtime logs. If Atlas blocks the first startup, add Render's outbound ranges in Atlas Network Access, wait for Atlas to apply the change, and deploy again. The runtime should log that the API is listening. If the assigned Render URL differs from WEB_ORIGIN, correct it in Environment and redeploy before logging in.

## 6. Verify the application

Open these URLs with your hostname:

1. `/health` should return `{"status":"ok"}`.
2. `/ready` should return HTTP 200 with `{"database":"connected"}`.
3. `/` should open the login page.
4. Sign in using an account already in the selected MongoDB database.
5. Open `/mess/customers` as owner, then refresh the browser. It should load normally.
6. Refresh after signing in to confirm the secure refresh cookie restores the session.
7. Check attendance, reports and an existing receipt without inserting test financial records into the live database.

Existing owners still require an active hotel and SaaS subscription/grace period. A subscription-expired response is separate from deployment or password failure.

## 7. Only if using an empty database

Prefer creating initial accounts from your local machine using Node 24 and a local ignored `.env` pointing at the new Atlas database. Keep its local WEB_ORIGIN setting appropriate to local development.

Set BOOTSTRAP_EMAIL, BOOTSTRAP_PASSWORD, BOOTSTRAP_NAME, and optionally DEMO_OWNER_EMAIL / DEMO_OWNER_PASSWORD. Both initial passwords must satisfy the existing 12-character uppercase/lowercase/digit rule. Run `npm run seed` once. It creates the initial admin and optionally a demo hotel/owner with its SaaS membership; it does not reset existing passwords. Remove bootstrap secrets from any hosted environment after initial setup. Do not rerun it expecting to change the already-updated accounts.

## Troubleshooting

| Symptom                              | Check                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------- |
| Build cannot find workspace packages | Root directory must be blank and npm must run from the repository root                |
| TypeScript, Vite or esbuild missing  | Use `npm ci --include=dev && npm run build`                                           |
| API JSON appears at the frontend URL | Verify the prepared app.ts was pushed and both applications were built                |
| Browser route refresh returns 404    | Ensure `apps/web/dist/index.html` exists and start from the repository root           |
| MongoDB timeout                      | Atlas outbound IP allowlist, cluster availability and MONGODB_URI                     |
| MongoDB authentication failure       | Atlas database username/password and URL encoding                                     |
| CSRF_REJECTED                        | WEB_ORIGIN must exactly match the browser's HTTPS origin                              |
| Session disappears after refresh     | Keep frontend and API on this same service and VITE_API_URL as `/api/v1`              |
| SUBSCRIPTION_EXPIRED                 | Renew the hotel's SaaS membership through the admin dashboard                         |
| First request is slow on Free        | Render spins down inactive free services; use an appropriate paid plan for production |

Future code changes deploy through GitHub pushes when auto-deploy is enabled. VITE_API_URL is applied at build time; rebuild if it changes. Database backups and production account credentials remain operator responsibilities.

Sources: https://render.com/docs/deploy-node-express-app, https://render.com/docs/web-services, https://render.com/docs/node-version, https://render.com/docs/connect-to-mongodb-atlas, https://render.com/docs/free.
