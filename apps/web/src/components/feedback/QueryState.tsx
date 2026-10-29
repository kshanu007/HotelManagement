import { LoaderCircle, CircleAlert, Inbox } from 'lucide-react';
import { Button } from '../ui/button';
export function Loading() {
  return (
    <div role="status" className="empty flex items-center justify-center gap-3">
      <LoaderCircle className="animate-spin" size={20} /> Loading your workspace…
    </div>
  );
}
export function ErrorState({ error, retry }: { error: Error; retry?: () => void }) {
  return (
    <div role="alert" className="card my-4 flex flex-wrap items-center gap-3 text-destructive">
      <CircleAlert size={20} />
      <p className="flex-1">{error.message}</p>
      {retry && (
        <Button variant="outline" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}
export function Empty({
  message = 'No records yet. Add your first one to get started.',
}: {
  message?: string;
}) {
  return (
    <div className="empty">
      <Inbox className="mx-auto mb-3" size={28} />
      <p>{message}</p>
    </div>
  );
}
