# Database models

All records have MongoDB ObjectId identifiers and UTC timestamps. Hotel-owned records additionally have `tenantId` and `deletedAt`. Operational business dates are calendar strings (`YYYY-MM-DD`) interpreted in the configured hotel timezone; timestamps remain UTC.

Platform models: User, Tenant, SaaSPlan, TenantSubscription, SaaSInvoice, SaaSPayment, SaaSRefund, RefreshSession, RefreshFamily, AuditLog, PlatformSettings.

Hotel models: HotelSettings, MessCustomer, MessPlan, MessSubscription, MessAttendance, MessLeave, MessAdjustment, MessInvoice, MessPayment, MessRefund, CustomerCreditLedger, DailySale, Vendor, VendorCategory, VendorPurchase, VendorPurchaseItem, VendorPayment, VendorRefund, Expense, ExpenseCategory, FinancialCorrection. Idempotency stores transaction results and request fingerprints for safe retries. The credit account uses a kind discriminator (`mess`, `vendor`, `saas`) and serializes concurrent writes for a party. Attendance, leave and entitlement adjustments also acquire a party lock to prevent conflicting concurrent changes.

Subscription plans snapshot their names, prices, meal and diet at assignment. Plan edits cannot change historical invoices. Subscription periods are inclusive and cannot overlap for a customer/hotel. Renewals create new subscriptions and invoices. Leave cancellation changes leave status; financial adjustments and entitlement extensions are separate audited records.

Invoices and purchases have cached allocated payment/credit totals. Invoices retain original service dates for revenue recognition. Payments preserve original receipt amounts and allocations. Advances are retained on the account and consumed on later invoices/purchases. Refunds and credits rebuild derived balances transactionally. Financial corrections link originals to replacements through voidedAt/supersededBy; the correction collection retains the reason and original snapshot. No financial DELETE endpoint is exposed. Contact records are deactivated through status updates.

See `apps/api/src/core/database/models.ts` for authoritative schema definitions and indexes. MongoDB transactions require replica-set deployment. Initialize model indexes before first traffic in production; review index creation as a deployment step rather than dropping indexes blindly.
