import {
  LayoutDashboard,
  Utensils,
  CalendarDays,
  Receipt,
  Wallet,
  ShoppingBasket,
  Truck,
  BarChart3,
  Settings,
  Building2,
  Layers,
  BadgeIndianRupee,
  Tags,
  FileText,
} from 'lucide-react';
export const ownerNavigation = [
  { label: 'Overview', items: [{ path: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    label: 'Daily workspace',
    items: [{ path: 'mess', label: 'Mess management', icon: Utensils }],
  },
  {
    label: 'Money & operations',
    items: [
      { path: 'sales', label: 'Daily sales', icon: BadgeIndianRupee },
      { path: 'vendors', label: 'Vendors', icon: Truck },
      { path: 'purchases', label: 'Purchases', icon: ShoppingBasket },
      { path: 'vendor-refunds', label: 'Vendor refunds', icon: Wallet },
      { path: 'vendor-payments', label: 'Vendor payments', icon: Wallet },
      { path: 'expenses', label: 'Expenses', icon: Receipt },
      { path: 'vendor-categories', label: 'Vendor categories', icon: Tags },
      { path: 'expense-categories', label: 'Expense categories', icon: Tags },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { path: 'corrections', label: 'Corrections', icon: Receipt },
      { path: 'reports', label: 'Reports', icon: BarChart3 },
      { path: 'settings', label: 'Settings', icon: Settings },
    ],
  },
];
export const adminNavigation = [
  {
    label: 'Platform',
    items: [
      { path: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { path: 'hotels', label: 'Hotels', icon: Building2 },
      { path: 'saas-plans', label: 'SaaS plans', icon: Layers },
      { path: 'saas-subscriptions', label: 'Subscriptions', icon: CalendarDays },
      { path: 'saas-invoices', label: 'Invoices', icon: FileText },
      { path: 'saas-refunds', label: 'Refunds', icon: Wallet },
      { path: 'saas-payments', label: 'Collections', icon: Wallet },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { path: 'reports', label: 'Reports', icon: BarChart3 },
      { path: 'settings', label: 'Settings', icon: Settings },
    ],
  },
];
