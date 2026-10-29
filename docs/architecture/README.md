# Architecture and security

One Express application, one React application, shared TypeScript workspace packages, and a MongoDB replica set. HTTP routes validate and delegate; operations service owns business rules; reporting service owns filters and aggregates. The schema-driven operations UI reuses one table and form implementation, rather than duplicating CRUD pages.

Tenant identity comes only from a verified JWT subject and the current user record. `repository(user, resource)` selects either a platform resource (administrator only) or a hotel resource (owner only). Hotel query filters include an ObjectId tenant scope and `deletedAt: null`. The initial `$match` is also mandatory for aggregations. Ownership checks use the same repository for related customers, categories, vendors, plans, and subscriptions. Unknown request properties, including tenantId, are rejected by strict Zod schemas. No raw Mongo query is accepted from clients.

Access tokens expire in 15 minutes and stay in browser memory. Refresh tokens are random opaque credentials stored only in HTTP-only, SameSite=Strict cookies, with Secure enabled in production. Only token digests are stored in MongoDB. Refresh rotation atomically claims a token. Reuse revokes a durable family record. JWTs carry a session identifier; authenticated requests verify both the session and family, so logout and detected reuse invalidate access immediately. Password changes revoke every session/family and increment the user password version. Query caches are cleared when accounts change, including cross-tab refresh changes.

All mutating API requests require an exact allowed Origin header, including login and refresh. CORS permits one configured origin with credentials. Service-to-service clients must supply that origin. The frontend must run on the same origin as its `/api` proxy, or in an appropriately configured same-site deployment. Rate limits protect authentication and general API routes. Helmet supplies security headers. Request logging redacts cookies and Authorization headers. Production errors omit internal stacks.

Hotel status is checked on each authenticated request. Business APIs additionally require a currently valid platform subscription or configured grace period. Settings remain readable after expiry. Administrator account creation is restricted to the bootstrap CLI.

Sensitive writes generate audit records. Core financial writes and their audit events commit in the same transaction. Models and validation reject fractional paise. Compound indexes prevent duplicate customer codes, attendance, subscription invoices, and idempotency keys per tenant.

Operational limitations and hardening tasks are tracked in PROGRESS.md. Do not treat generated deployment files as evidence of production certification.
