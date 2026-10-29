# REST API

Base: `/api/v1`. Responses use `{ success: true, data }` or `{ success: false, error: { code, message, details? } }`. Writes require `Origin` equal to `WEB_ORIGIN`; authenticated routes require `Authorization: Bearer <access token>`.

Auth: POST `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/change-password`, `/auth/revoke-sessions`; GET `/auth/me`.

Platform resources: `hotels`, `saas-plans`, `saas-subscriptions`, `saas-invoices`, `saas-payments`, `saas-refunds`.

Owner resources: `customers`, `mess-plans`, `subscriptions`, `attendance`, `leaves`, `adjustments`, `mess-invoices`, `mess-payments`, `mess-refunds`, `sales`, `vendors`, `vendor-categories`, `purchases`, `vendor-payments`, `vendor-refunds`, `expenses`, `expense-categories`, `corrections`.

Resource routes: GET `/:resource` (page, limit, q, sort, order, status, relevant reference IDs), GET `/:resource/:id`, POST `/:resource`, PUT `/:resource/:id`. Invoices and corrections are read-only. Subscriptions, adjustments, receipts and refunds reject PUT. Expenses, sales and purchases accept PUT with a mandatory correction reason in `note`; a new replacement ID is returned and the original is preserved. Master records support complete validated updates, hotels support partial status/profile updates, leaves accept cancellation only. Financial creates, subscriptions and hotel creation require a unique 16–128-character `Idempotency-Key`. Attendance duplicate creation returns 409; correction uses PUT. No destructive DELETE route exists.

Other routes: GET `/dashboard`, GET/PUT `/settings`, GET `/subscription-status` (owner plan/grace details), GET `/audit` (latest 100 events scoped by role). Settings and subscription details remain accessible after platform entitlement expiry.

Reports: GET `/reports/:name`; GET `/reports/:name/export/:format` (`csv`, `xlsx`, `pdf`). Names: daily-sales, mess-collection, mess-outstanding, attendance, members, vendor-purchases, vendor-payments, vendor-outstanding, vendor-ledger, expenses, income, profit-loss, cash-upi, saas-revenue, hotel-registrations. Platform report access is restricted to the final two names. Filters include preset, from, to, customerId, vendorId, hotelId, planId, categoryId, method. Custom periods require from <= to. Outstanding and member reports are snapshots, not period flows.

The additional `customer-ledger` report combines invoice debits, payments, credit adjustments and refunds with a running balance and opening history. Open it from a customer profile or the report selector; filter with customerId. It shares the same streaming exports as the other reports.

Health: GET `/health`, `/ready` (unversioned, unauthenticated).

Request schemas are defined in `packages/shared-validation/src/index.ts`. Run `npm run docs:api` to refresh the [OpenAPI document](openapi.json). SaaS revenue supports `groupBy=plan` and plan/hotel filters. Members support active/expired/upcoming status filters. Hotel registrations support accountStatus and subscriptionStatus filters. Payment reports include refunds as negative flows. Combined income, profit/loss, cash/UPI and vendor ledger reports use scoped union pipelines, not unrelated tables.
