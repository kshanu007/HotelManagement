import { test, expect } from '@playwright/test';
test('owner manages a customer and persists theme without exposing tokens', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill('owner@e2e.test');
  await page.getByLabel('Password', { exact: true }).fill('BrowserTestPass123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back, Test.' })).toBeVisible();
  await page.getByRole('link', { name: 'Mess management', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mess management', exact: true })).toBeVisible();
  await expect(
    page.locator('aside').getByRole('link', { name: 'Mess management', exact: true }),
  ).toHaveCount(1);
  await expect(
    page.locator('aside').getByRole('link', { name: 'Memberships', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('link', { name: 'Meal plans', exact: true }).click();
  await page.getByRole('button', { name: 'Add meal plan', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Name', { exact: true }).fill('Monthly lunch');
  await page.getByLabel('Plan price (₹)').fill('3000.01');
  await page.getByRole('button', { name: 'Save record' }).click();
  await expect(page.getByRole('cell', { name: 'Monthly lunch', exact: true })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Mess sections' })
    .getByRole('link', { name: 'Customers', exact: true })
    .click();
  await page.getByRole('button', { name: 'Add customer' }).click();
  await page.getByLabel('Customer ID').fill('E2E-001');
  await page
    .getByRole('dialog')
    .getByRole('textbox', { name: 'Name', exact: true })
    .fill('Asha Patil');
  await page.getByRole('dialog').getByLabel('Phone').fill('9876543210');
  await page
    .getByRole('dialog')
    .getByLabel('Meal plan', { exact: true })
    .selectOption({ label: 'Monthly lunch | \u20b93,000.01 | 30 days | lunch' });
  await page.getByRole('dialog').getByLabel('Start Date', { exact: true }).fill('2099-12-02');
  await page.getByRole('button', { name: 'Save record' }).click();
  await expect(page.getByRole('cell', { name: 'Asha Patil' })).toBeVisible();
  await page.getByRole('button', { name: 'View →' }).click();
  await expect(
    page.getByRole('dialog').getByText('Latest membership', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('dialog').getByText('₹3,000.01', { exact: true })).toBeVisible();
  await page
    .getByRole('dialog')
    .getByRole('link', { name: 'Collect payment', exact: true })
    .click();
  await expect(page.getByRole('dialog').getByLabel('Customer Id', { exact: true })).toHaveValue(
    /^[a-f0-9]{24}$/,
  );
  await expect(page.getByRole('dialog').getByLabel('Customer Id', { exact: true })).toContainText(
    'Asha Patil',
  );
  const customerId = await page
    .getByRole('dialog')
    .getByLabel('Customer Id', { exact: true })
    .inputValue();
  await page.getByLabel('Amount (₹)').fill('1000.01');
  await page.getByRole('button', { name: 'Save record' }).click();
  await expect(page.getByRole('cell', { name: '₹1,000.01', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'View →' }).click();
  await expect(
    page.getByRole('dialog').getByText('Payment receipt', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('dialog').getByText('Asha Patil', { exact: true })).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  await expect(
    page.getByRole('dialog').getByText('Payment receipt', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Mess management', exact: true })).toBeHidden();
  await page.pdf({ path: 'test-results/mess-receipt.pdf', format: 'A4' });
  await page.emulateMedia({ media: 'screen' });
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Toggle theme' }).click();
  await expect(page.locator('html')).toHaveClass('dark');
  await page.reload();
  await expect(page.locator('html')).toHaveClass('dark');
  const storage = await page.evaluate(() => JSON.stringify(localStorage));
  expect(storage).not.toContain('accessToken');
  expect(storage).not.toContain('refreshToken');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy();
  await page.screenshot({ path: 'test-results/owner-mobile.png', fullPage: true });
  await page
    .getByRole('navigation', { name: 'Mess sections' })
    .getByRole('link', { name: 'Attendance & leave', exact: true })
    .click();
  await page.getByLabel('Attendance date', { exact: true }).fill('2099-12-02');
  const rosterRow = page.getByRole('row').filter({ hasText: 'Asha Patil' });
  await expect(rosterRow).toContainText('unmarked');
  await rosterRow.getByRole('button', { name: 'Present', exact: true }).click();
  await expect(rosterRow.getByRole('button', { name: 'Present', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(rosterRow.getByRole('button', { name: 'Absent', exact: true })).toBeEnabled();
  await rosterRow.getByRole('button', { name: 'Absent', exact: true }).click();
  await expect(rosterRow.getByRole('button', { name: 'Absent', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await rosterRow.getByRole('button', { name: 'Leave', exact: true }).click();
  await page.getByRole('dialog').getByLabel('End Date', { exact: true }).fill('2099-12-04');
  await expect(page.getByRole('dialog')).toContainText('Leave calculation: 3 days / 3 meals');
  await page.getByRole('button', { name: 'Save record' }).click();
  await expect(rosterRow).toContainText('On leave');
  await expect(rosterRow).toContainText('3 days / 3 meals');
  await expect(rosterRow.getByRole('button', { name: 'Present', exact: true })).toBeDisabled();
  await expect(page.getByText('Leave saved', { exact: true })).toBeHidden();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy();
  await page.screenshot({ path: 'test-results/attendance-mobile.png', fullPage: true });
  await page.getByRole('link', { name: 'Leave', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add leave', exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page
    .getByRole('navigation', { name: 'Mess sections' })
    .getByRole('link', { name: 'Customers', exact: true })
    .click();
  await expect(page.getByRole('cell', { name: 'Asha Patil', exact: true })).toBeVisible();
  await page.screenshot({
    path: 'test-results/mess-workspace-desktop.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'View →' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Assign / renew plan', exact: true })
    .click();
  await expect(page.getByRole('dialog').getByLabel('Customer Id', { exact: true })).toHaveValue(
    customerId,
  );
  await expect(page.getByRole('dialog').getByLabel('Start Date', { exact: true })).toHaveValue(
    '2100-01-01',
  );
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.goto(`/attendance?customerId=${customerId}`);
  await expect(page).toHaveURL(new RegExp(`/mess/attendance\\?customerId=${customerId}`));
  await expect(page.getByText('Records for')).toContainText('Asha Patil');
  await page.getByRole('button', { name: 'Show all records', exact: true }).click();
  await expect(page).toHaveURL(/\/mess\/attendance$/);
});
test('switching accounts clears cached hotel data', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('owner@e2e.test');
  await page.getByLabel('Password', { exact: true }).fill('BrowserTestPass123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back, Test.' })).toBeVisible();
  await page.evaluate(() => {
    history.pushState({}, '', '/login');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await page.getByLabel('Email', { exact: true }).fill('admin@e2e.test');
  await page.getByLabel('Password', { exact: true }).fill('BrowserTestPass123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    page
      .locator('.card')
      .filter({ has: page.getByText('Registered hotels', { exact: true }) })
      .getByText('1', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Mess customers', { exact: true })).toHaveCount(0);
});
test('platform administrator sees a separate dashboard and hotel subscriptions', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('admin@e2e.test');
  await page.getByLabel('Password', { exact: true }).fill('BrowserTestPass123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('Registered hotels', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/platform-dashboard.png', fullPage: true });
  await page.getByRole('link', { name: 'Hotels', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Test Kitchen' })).toBeVisible();
  await page.getByRole('link', { name: 'Reports', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Reports & insights' })).toBeVisible();
  await expect(page.getByLabel('Report')).toHaveValue('saas-revenue');
});
