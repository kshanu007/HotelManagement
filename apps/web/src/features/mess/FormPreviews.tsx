import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { date } from '@annapurna/validation';
import { keys } from '../../config/query.config';
import { resourceApi } from '../../services/resources';
import { currency } from '../../utils/format';

export function EnrollmentPreview({ values }: { values: Record<string, unknown> }) {
  const id = String(values.planId ?? '');
  const plan = useQuery({
    queryKey: keys.detail('mess-plans', id),
    queryFn: () => resourceApi.detail('mess-plans', id),
    enabled: !!id,
  });
  return (
    <div className="rounded-lg bg-muted p-4 text-sm" aria-live="polite">
      {plan.data ? (
        <>
          <p className="font-semibold">
            {String(plan.data.name)}: {currency(plan.data.pricePaise)}
          </p>
          <p>
            {String(plan.data.durationDays)} days of {String(plan.data.meal)}. The membership and
            invoice are created with this customer.
          </p>
          {plan.data.status !== 'active' && (
            <p className="text-destructive">Select an active meal plan.</p>
          )}
        </>
      ) : (
        <p>
          Select a meal plan to start the membership with this customer.{' '}
          <Link className="text-primary underline" to="/mess/mess-plans?action=create">
            Create a meal plan first
          </Link>{' '}
          if you have none.
        </p>
      )}
      {plan.error && <p className="text-destructive">{plan.error.message}</p>}
    </div>
  );
}

export function LeavePreview({ values }: { values: Record<string, unknown> }) {
  const start = date.safeParse(values.startDate),
    end = date.safeParse(values.endDate);
  const days =
    start.success && end.success && end.data >= start.data
      ? Math.round((Date.parse(end.data) - Date.parse(start.data)) / 86400000) + 1
      : 0;
  return (
    <div className="rounded-lg bg-muted p-4 text-sm" aria-live="polite">
      <p className="font-semibold">
        Leave calculation: {days} days / {days * (values.meal === 'both' ? 2 : 1)} meals
      </p>
      <p>
        Includes both dates. Leave must fit within the selected customer&apos;s membership. Credits
        and extensions are recorded separately in Customers.
      </p>
    </div>
  );
}
