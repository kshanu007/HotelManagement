import { Link, Navigate, useParams } from 'react-router-dom';
import { ROLES } from '@annapurna/constants';
import { messSections, resourcePath } from '../../config/mess.config';
import { useSession } from '../../stores/session';
import { ErrorState } from '../../components/feedback/QueryState';
import ResourcePage from '../operations/ResourcePage';
import AttendanceBoard from './AttendanceBoard';

export default function MessWorkspace() {
  const { resource = 'customers' } = useParams();
  const role = useSession((state) => state.user?.role);
  if (role !== ROLES.owner)
    return <ErrorState error={new Error('The mess workspace is available to hotel owners')} />;
  const section = messSections.find((group) =>
    group.resources.some((item) => item.resource === resource),
  );
  if (!section) return <Navigate to={resourcePath('customers')} replace />;
  return (
    <>
      <div className="mb-6">
        <p className="eyebrow mb-2">Your daily workspace</p>
        <h1 className="page-title">Mess management</h1>
        <p className="mt-2 text-muted-foreground">
          Customers, meals and money. Everything you need, together.
        </p>
      </div>
      <nav
        aria-label="Mess sections"
        className="mb-5 grid grid-cols-2 gap-2 rounded-xl border bg-card p-2 md:grid-cols-4"
      >
        {messSections.map((group) => {
          const active = group === section;
          return (
            <Link
              key={group.label}
              to={resourcePath(group.resources[0].resource)}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-12 items-center justify-center gap-2 rounded-lg px-3 py-3 text-center text-sm font-medium ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
            >
              <group.icon size={17} className="shrink-0" />
              {group.label}
            </Link>
          );
        })}
      </nav>
      <section aria-label={`${section.label} workspace`}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{section.description}</p>
          {section.resources.length > 1 && (
            <nav
              aria-label={`${section.label} views`}
              className="flex max-w-full flex-wrap gap-1 rounded-lg bg-muted p-1"
            >
              {section.resources.map((item) => (
                <Link
                  key={item.resource}
                  to={resourcePath(item.resource)}
                  aria-current={item.resource === resource ? 'page' : undefined}
                  className={`rounded-md px-3 py-2 text-xs font-medium ${item.resource === resource ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          )}
        </div>
        {resource === 'attendance' ? <AttendanceBoard /> : <ResourcePage key={resource} embedded />}
      </section>
    </>
  );
}
