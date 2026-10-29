import { useEffect, useRef, useId } from 'react';
import { X } from 'lucide-react';
import { Button } from './button';
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={onClose}
      className="w-[min(94vw,620px)] rounded-xl border p-6 shadow-xl"
    >
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 id={titleId} className="text-xl font-semibold">
          {title}
        </h2>
        <Button aria-label="Close dialog" variant="ghost" size="icon" onClick={onClose}>
          <X />
        </Button>
      </div>
      {children}
    </dialog>
  );
}
