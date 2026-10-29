import { useQuery } from '@tanstack/react-query';
import { keys } from '../../config/query.config';
import { resourceApi } from '../../services/resources';
import { Button } from '../../components/ui/button';

export function CustomerContext({ id, onClear }: { id: string; onClear: () => void }) {
  const customer = useQuery({
    queryKey: keys.detail('customers', id),
    queryFn: () => resourceApi.detail('customers', id),
  });
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-secondary/50 px-4 py-3">
      <p className="text-sm">
        Records for <strong>{String(customer.data?.name ?? 'the selected customer')}</strong>
        {customer.error && (
          <span className="ml-2 text-xs text-destructive">{customer.error.message}</span>
        )}
      </p>
      <Button variant="ghost" size="sm" onClick={onClear}>
        Show all records
      </Button>
    </div>
  );
}
