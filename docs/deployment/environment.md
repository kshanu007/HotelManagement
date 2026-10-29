# Environment variables

The API and CLI scripts load the workspace root `.env`. Vite variables can be supplied in `apps/web/.env` or the build environment. Never put secrets in variables prefixed VITE_: those are public browser configuration.

| Variable            | Purpose                                                             |
| ------------------- | ------------------------------------------------------------------- |
| NODE_ENV            | development, test, production                                       |
| PORT                | API port; default 5000                                              |
| MONGODB_URI         | Replica-set connection URI; required                                |
| WEB_ORIGIN          | Exact browser origin, without a trailing slash; HTTPS in production |
| JWT_SECRET          | At least 48 cryptographically random characters                     |
| REFRESH_DAYS        | Refresh/session family lifetime, 1–30; default 7                    |
| BOOTSTRAP_EMAIL     | Initial administrator email, CLI only                               |
| BOOTSTRAP_PASSWORD  | Strong initial administrator password, CLI only                     |
| BOOTSTRAP_NAME      | Initial administrator display name                                  |
| DEMO_OWNER_EMAIL    | Optional demo hotel owner email, CLI only                           |
| DEMO_OWNER_PASSWORD | Enables optional demo hotel creation, CLI only                      |
| VITE_API_URL        | Public API URL; defaults to /api/v1                                 |
| API_PROXY_TARGET    | Local Vite proxy target; defaults to http://localhost:5000          |

Generate a secret with Node's crypto.randomBytes, enter it in a local ignored .env, and store production secrets in your cloud's secret manager. Do not place real secrets in command arguments, documentation, or committed files. Password bootstrap never prints the supplied password. The reset-link CLI intentionally prints a credential-bearing link for private administrator delivery.
