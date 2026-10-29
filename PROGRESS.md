# Implementation and validation status

Last verified: 29 October 2026. Local application implementation is present and the checks below pass. No production deployment, external account, or production credential has been created. Production acceptance remains subject to the operational limits below.

## Implemented

- Foundation: npm workspaces, strict TypeScript, shared constants/types/Zod validation, centralized Axios/query configuration, semantic tokens, light/dark/system themes, reusable shadcn-style Button, forms, tables, dialogs, receipts, lazy routes, responsive navigation, notifications, and error boundaries.
- Authentication: two roles, bootstrap-only administrator creation, bcrypt, 15-minute in-memory JWTs, rotating HTTP-only refresh cookies, durable refresh families, replay detection, immediate logout revocation, all-session revocation, password changes, reset requests and one-use reset links, Origin-based CSRF protection, rate limiting, audit records, tenant/account suspension, and subscription/grace gates.
- Isolation: authenticated ObjectId tenant scopes at repository/service boundaries, scoped aggregates and union branches, ownership checks for references, compound indexes, strict write schemas, role guards in UI/API, and cache clearing on account changes.
- Platform: hotel/owner creation, hotel status/profile management, SaaS plans, subscriptions/renewal periods, immutable invoices, partial/advance collections, refunds, dashboard metrics/charts, plan-wise revenue, registration/account/subscription filters, and platform settings.
- Hotel operations: customers and profiles/history, meal plans, snapshot subscriptions/renewals, duplicate-protected attendance and corrections, leave/cancellation, manual credits and free extensions with overlap protection, customer ledger and dues, cash/UPI collections and printable receipts.
- Financial operations: integer-paise FIFO allocations, persisted advances, request fingerprints/idempotency, concurrent transaction protection, separate refund records and reconciliation, daily reconciled sales, vendors/categories, itemized purchases, partial/advance vendor payments, vendor ledger, expenses/categories, and replacement-based expense/sale/purchase corrections retaining originals and reasons.
- Reports/settings: all 15 requested report types plus a unified customer ledger; day/week/month/year/custom periods; relevant customer/vendor/plan/hotel/category/method/status filters; earned revenue separated from billing and cash; service-period paise rounding across years; incurred purchases separated from vendor cash payments; streamed CSV/Excel/PDF; full filtered printable PDF; hotel profile/logo URL/timings/timezone/payment-method preferences; subscription/grace details; persistent theme preference.
- Delivery: API bundle, Vite build, environment validation/examples, Mongo replica-set Compose file, non-root API Dockerfile, health/readiness endpoints, graceful shutdown, GitHub Actions configuration, generated OpenAPI, setup/security/database/finance/testing/deployment/backup documentation.

## Verified checks

| Check                         | Result                                                          |
| ----------------------------- | --------------------------------------------------------------- |
| ESLint                        | Passed                                                          |
| TypeScript                    | Both applications passed; production builds also run TypeScript |
| Vitest unit/component         | 13 passed                                                       |
| MongoDB/Supertest integration | 26 passed                                                       |
| Playwright Chromium           | 3 passed                                                        |
| Production build              | API bundle and web build passed                                 |
| OpenAPI generation            | Passed                                                          |
| npm dependency audit          | 0 known vulnerabilities after upgrades/override                 |

Integration coverage includes login, role/tenant isolation, ownership, hotel creation, membership assignment and renewal, attendance duplication/correction, leave, partial/advance collections, concurrent idempotent retries, vendor dues, expense/purchase corrections, refunds, customer/vendor ledgers, filtered CSV/Excel/PDF, earned-revenue rounding across years, SaaS plan grouping, entitlement expiry/suspension, refresh reuse, immediate logout revocation, one-use resets/password changes, and audited extensions preserving financial snapshots.

Browser coverage includes owner customer → plan → membership → partial collection → receipt, theme persistence, 390px overflow checks, token absence from localStorage, switching accounts without cached tenant data, and platform hotel/report navigation. Desktop and mobile screenshots were visually inspected. This is not an exhaustive accessibility, browser, or device certification.

Environment: Windows; project-local Node 24.22.2 used for patched test tooling; MongoDB 7.0.14 disposable replica sets; Chromium. The host's system Node is 20.16, so use Node 24 LTS as documented. The build emits non-failing annotation warnings from the installed Zod dependency.

## Operational limits and remaining acceptance work

1. Start Docker Desktop or provide a persistent MongoDB replica-set URI, then create `.env` with your own random JWT secret and bootstrap credentials. No real business database or persistent demo accounts were fabricated. Run `npm run seed` for the administrator and optional demo owner.
2. Password reset uses private administrator delivery via `npm run reset-link -w @annapurna/api -- <email>`. Automated SMTP/email delivery is not implemented. If fully self-service email reset is required for launch, implement/configure a delivery adapter and verify delivery before marking that acceptance item complete.
3. Purchase quantities currently use whole units. Use grams/millilitres for fractional kilogram/litre quantities; decimal quantity entry is not implemented.
4. The Docker image could not be built/run here because Docker Desktop's engine was unavailable. The CI workflow is supplied but has not been executed on GitHub. Cloud infrastructure, HTTPS/proxy configuration, secret management, backup restoration rehearsal, and deployment require operator configuration and approval.
5. No sustained production load test, independent penetration test, full browser/device matrix, or exhaustive accessibility audit was performed. Review process-local rate limits and trusted-proxy settings before horizontal deployment. No Redis or unsupported modules were added.

Exact continuation point for production acceptance: resolve reset delivery/quantity requirements if needed, configure persistent development credentials/database, run the supplied Docker image and hosted CI, then complete deployment-specific QA and backup/restore validation. Source code, schemas, endpoint inventory, financial rules, and commands are documented under README.md and docs/.

## Owner mess navigation update

Replaced nine separate mess sidebar links with one Mess management workspace. Four task groups contain Customers (customer list, memberships, adjustments), Attendance & leave, Billing (collections, invoices, refunds), and Meal plans. Customer details now combine contact information, latest membership, backend-calculated dues, direct prefilled collection/renewal/leave actions, and history links. Renewal forms suggest the next eligible start date. A named customer-context banner can clear history filters. Old mess URLs redirect while retaining query parameters; dashboard shortcuts use the new routes.

Shared forms, tables, tenant checks, financial APIs and records are retained. Reference selectors resolve a preselected customer even outside their first search page. Print styles support receipts nested in the workspace. Test ports are configurable so browser validation can run alongside the real application.

Validation for this change: strict type checks and lint passed; API and web builds passed; 13 unit/component tests passed; all 3 Chromium workflows passed. Owner coverage includes grouped navigation, preselected payment customer, backend dues, renewal start date across a year boundary, mobile overflow, receipt print output, legacy URL redirects, and clearing customer context. Tests use disposable MongoDB on separate ports, not the configured Atlas database. See docs/features/mess-workspace.md for the owner workflow.

## Customer enrollment and daily attendance update

Add customer now includes an active meal plan and start date. A shared strict enrollment schema and idempotent API save the customer, membership, invoice and audits in one MongoDB transaction. Failed or foreign plan references roll back the customer. Existing customer editing and customer-only API integrations retain their behavior.

Attendance now shows a searchable, paginated roster for the selected date and meal, with Present/Absent correction buttons and prefilled leave entry. Mobile rows stack the customer, status, monthly leave totals and actions. Leave forms preview inclusive days and meals. Backend monthly totals clip cross-month leave, count distinct days across lunch/dinner, exclude cancelled leave, and preserve tenant isolation. On-leave meals cannot be marked Present. Credits and membership extensions remain explicit owner adjustments; no automatic financial policy was introduced.

Validation completed: final type checks and lint passed; API/web production builds and OpenAPI regeneration passed; 13 unit/component tests and all 26 MongoDB integration tests passed. All 3 Chromium workflows passed, and the owner workflow passed again after the final mobile layout change. Integration coverage includes enrollment rollback/retries, tenant isolation, monthly leave clipping, distinct days and cancellation. Browser coverage includes combined customer/plan enrollment, Present-to-Absent correction, prefilled leave, calculation preview, On leave status and disabled marking. The final mobile attendance screenshot was visually inspected. All automated data is in disposable databases on separate ports; the configured business database is not modified. Existing operational limits above remain.

## Render deployment preparation

The production API now serves the built frontend from `apps/web/dist` when started from the repository root. Browser routes fall back to index.html while API failures retain JSON responses. Added a validated TRUST_PROXY_HOPS setting (default 0) so a standard Render deployment can explicitly trust its proxy hop for client IP rate limiting. Added a complete single-web-service Render walkthrough with build/start commands, environment variables, Atlas outbound-IP access, existing-versus-empty database setup and verification steps.

Validation: type checks, lint, API/web builds, 13 unit/component tests and 26 MongoDB integration tests passed. Production-mode HTTP smoke checks passed for the SPA root/deep routes, built JavaScript assets, a forwarded-client-IP request, health/readiness responses and API JSON errors. Readiness correctly returned 503 with no database connection in the smoke check; integration tests separately used temporary replica sets. No cloud service was created, no deployment was performed, and the live business database was not changed. Render proxy topology, public HTTPS, account login and Atlas access must be verified on the actual service after deployment. These preparation changes have not been committed or pushed by the agent.
