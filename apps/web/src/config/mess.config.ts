import { CalendarCheck, Users, Utensils, Wallet } from 'lucide-react';

export const messSections = [
  {
    label: 'Customers',
    icon: Users,
    description: 'People, memberships and renewals in one place.',
    resources: [
      { resource: 'customers', label: 'Customer list', action: 'Add customer' },
      { resource: 'subscriptions', label: 'Memberships', action: 'Assign / renew plan' },
      { resource: 'adjustments', label: 'Credits & extensions', action: 'Add adjustment' },
    ],
  },
  {
    label: 'Attendance & leave',
    icon: CalendarCheck,
    description: 'Manage daily meals and planned breaks together.',
    resources: [
      { resource: 'attendance', label: 'Attendance', action: 'Mark attendance' },
      { resource: 'leaves', label: 'Leave', action: 'Add leave' },
    ],
  },
  {
    label: 'Billing',
    icon: Wallet,
    description: 'Collections, invoices and refunds, with a clear history.',
    resources: [
      { resource: 'mess-payments', label: 'Collections', action: 'Record payment' },
      { resource: 'mess-invoices', label: 'Invoices', action: '' },
      { resource: 'mess-refunds', label: 'Refunds', action: 'Record refund' },
    ],
  },
  {
    label: 'Meal plans',
    icon: Utensils,
    description: 'Set up the meal options your customers can join.',
    resources: [{ resource: 'mess-plans', label: 'Meal plans', action: 'Add meal plan' }],
  },
];

export const messResources = messSections.flatMap((section) =>
  section.resources.map((item) => item.resource),
);
export function resourcePath(resource: string) {
  return messResources.includes(resource) ? `/mess/${resource}` : `/${resource}`;
}
export function messItem(resource: string) {
  return messSections
    .flatMap((section) => section.resources)
    .find((item) => item.resource === resource);
}
