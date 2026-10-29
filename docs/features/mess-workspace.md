# Owner mess workspace

The owner sidebar has one Mess management entry, at `/mess/customers`. Its four sections follow daily tasks:

| Section            | Views                                              |
| ------------------ | -------------------------------------------------- |
| Customers          | Customer list, memberships, credits and extensions |
| Attendance & leave | Meal attendance, leave history and cancellation    |
| Billing            | Collections, invoices, refunds and receipts        |
| Meal plans         | Plan setup and editing                             |

Open a customer from the list to see contact details, the latest membership and backend-calculated outstanding balance. Collect payment, Assign / renew plan and Add leave open the relevant form with that customer selected. Renewals suggest the day after the latest membership ends, or today if it has expired. Backend validation still enforces entitlement dates and overlap rules.

## Add customer and meal plan together

Create reusable plans once in Meal plans. Add customer now includes an active meal-plan selector and membership start date. The options show price, duration and meals; the preview explains the invoice. Saving creates the customer, membership and invoice in one transaction through `POST /customers/enroll`, with a required idempotency key. Invalid or foreign plans roll back customer creation. The existing `POST /customers` API remains available for customer-only integrations; customer editing never assigns or charges another plan. Use Assign / renew plan for existing customers.

## Mark attendance and calculate leave

Attendance opens a daily roster instead of a blank record form. Choose the date and Lunch or Dinner. Only active customers whose memberships cover that meal and date appear. Search by name, customer ID or phone, then use Present or Absent. Clicking the other status corrects the existing attendance record. An empty roster explains that a valid membership is required.

Use Leave beside a customer to open a prefilled leave form. Its calculation includes both dates and counts one meal per day for Lunch or Dinner, two for Both. Backend validation checks membership coverage and overlaps. For dates already marked Present, change those meals to Absent before recording leave. Approved leave appears as On leave and disables attendance marking; cancel it from the Leave history view to resume marking.

The roster displays each customer's leave days and meals for the selected calendar month, calculated by the API. Cross-month leave is clipped to that month, separate lunch/dinner leave on the same date counts as one day and two meals, and cancelled leave is excluded. Counts cover both meals regardless of the roster meal filter. Leave counts do not automatically grant a credit or extend a membership; approved financial adjustments remain in Customers / Credits & extensions.

`GET /mess/attendance-roster` accepts `date`, `meal`, optional `customerId`, `q` and `page`. It returns 20 eligible customers per page, attendance identifiers/statuses and monthly leave totals, using the authenticated hotel scope.

Customer history links keep the selected customer filter. A visible Records for banner names the customer; Show all records clears the filter. Closing or saving a context-opened form removes its create action from the URL so refreshing does not reopen the form.

All nine earlier mess URLs redirect into the workspace while preserving their query parameters. Existing dashboard shortcuts and bookmarks continue to work. Navigation and action captions are centralized in `apps/web/src/config/mess.config.ts`. The workspace uses a dedicated attendance roster alongside ResourcePage, sharing forms, query services, validation and API authorization.

Receipt printing supports dialogs nested inside the workspace. Navigation, headers and tables are excluded from print while the receipt remains visible. This change does not modify stored hotel, subscription or financial data.
