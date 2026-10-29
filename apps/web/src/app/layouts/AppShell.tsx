import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  UtensilsCrossed,
  ChevronLeft,
  Menu,
  X,
  Sun,
  Moon,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { ROLES } from '@annapurna/constants';
import { useSession } from '../../stores/session';
import { usePreferences } from '../../stores/preferences';
import { adminNavigation, ownerNavigation } from '../../config/navigation.config';
import { Button } from '../../components/ui/button';
import { authApi } from '../../features/auth/api';
import { queryClient } from '../../config/query.config';
import { toast } from 'sonner';
import { messItem } from '../../config/mess.config';
import { label } from '../../utils/format';
export default function AppShell() {
  const user = useSession((s) => s.user);
  const collapsed = usePreferences((s) => s.collapsed),
    toggle = usePreferences((s) => s.toggle),
    theme = usePreferences((s) => s.theme),
    setTheme = usePreferences((s) => s.setTheme);
  const [mobile, setMobile] = useState(false);
  const location = useLocation(),
    navigate = useNavigate();
  const navigation = user?.role === ROLES.admin ? adminNavigation : ownerNavigation;
  async function logout() {
    try {
      await authApi.logout();
      useSession.getState().set(null, null);
      queryClient.clear();
      navigate('/login');
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <div className="min-h-screen">
      {mobile && (
        <button
          aria-label="Close navigation backdrop"
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMobile(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r bg-card transition-all ${collapsed ? 'lg:w-20' : 'lg:w-64'} ${mobile ? 'w-64 translate-x-0' : 'w-64 -translate-x-full lg:translate-x-0'}`}
      >
        <div className="flex h-20 shrink-0 items-center justify-between px-6">
          <NavLink to="/dashboard" className="flex items-center gap-3 text-primary">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <UtensilsCrossed size={19} />
            </span>
            <span className={collapsed ? 'lg:hidden' : ''}>
              <span className="block font-serif text-2xl leading-6">Annapurna</span>
              <span className="text-[9px] uppercase tracking-[.17em] text-muted-foreground">
                Hotel & mess management
              </span>
            </span>
          </NavLink>
          <Button
            className="lg:hidden"
            variant="ghost"
            size="icon"
            aria-label="Close navigation"
            onClick={() => setMobile(false)}
          >
            <X />
          </Button>
        </div>
        <div
          className={`mx-4 mb-4 rounded-lg border bg-background p-3 ${collapsed ? 'lg:hidden' : ''}`}
        >
          <p className="text-xs font-semibold">
            {user?.role === ROLES.admin ? 'Platform workspace' : 'Hotel workspace'}
          </p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{user?.name}</p>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-5">
          {navigation.map((group) => (
            <div key={group.label}>
              <p
                className={`mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground ${collapsed ? 'lg:hidden' : ''}`}
              >
                {group.label}
              </p>
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={`/${item.path}`}
                  title={item.label}
                  onClick={() => setMobile(false)}
                  className={({ isActive }) =>
                    `mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] ${isActive ? 'bg-primary font-medium text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`
                  }
                >
                  <item.icon size={17} className="shrink-0" />
                  <span className={collapsed ? 'lg:hidden' : ''}>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <button
          className="flex items-center gap-3 border-t p-5 text-xs text-muted-foreground"
          onClick={toggle}
        >
          <ChevronLeft size={17} className={collapsed ? 'rotate-180' : ''} />
          <span className={collapsed ? 'lg:hidden' : ''}>Collapse sidebar</span>
        </button>
      </aside>
      <div className={collapsed ? 'lg:ml-20' : 'lg:ml-64'}>
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between gap-4 border-b bg-background/95 px-5 backdrop-blur md:px-9">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu />
            </Button>
            <p className="text-xs text-muted-foreground">
              Workspace <span className="mx-2 opacity-40">/</span>
              <span className="text-foreground">
                {location.pathname.startsWith('/mess/')
                  ? `Mess / ${messItem(location.pathname.split('/')[2])?.label ?? 'Customers'}`
                  : label(location.pathname.split('/')[1] || 'Dashboard')}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              aria-label="Toggle theme"
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <Sun /> : <Moon />}
            </Button>
            <details className="relative">
              <summary className="flex cursor-pointer list-none items-center gap-2">
                <span className="flex size-9 items-center justify-center rounded-full bg-secondary font-semibold text-primary">
                  {user?.name.slice(0, 1)}
                </span>
                <span className="hidden text-xs sm:block">{user?.name}</span>
                <ChevronDown size={13} />
              </summary>
              <div className="absolute right-0 mt-4 w-52 rounded-lg border bg-card p-2 shadow-lg">
                <p className="truncate px-3 py-2 text-xs text-muted-foreground">{user?.email}</p>
                <NavLink to="/settings" className="block rounded p-3 text-sm hover:bg-muted">
                  Account settings
                </NavLink>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => void logout()}
                >
                  <LogOut /> Sign out
                </Button>
              </div>
            </details>
          </div>
        </header>
        <main className="mx-auto max-w-[1600px] p-5 pb-14 md:p-9">
          <Outlet />
        </main>
        <footer className="border-t px-9 py-5 text-xs text-muted-foreground">
          Annapurna <span className="mx-2">·</span> A clearer view of your business.
        </footer>
      </div>
    </div>
  );
}
