# Repository guidelines

Use npm workspaces. The API owns all financial calculations. Every hotel query must use authenticated tenant context through the repository. Never accept tenantId from request bodies. Use integer paise, immutable invoices/payments, explicit transactions, and idempotency keys. Validate all writes with shared Zod schemas. Run typecheck, lint, tests, and build before recording validation. Do not deploy or commit credentials. Update PROGRESS.md honestly when work remains.
