import { useEffect, useState } from 'preact/hooks';
import type { ToastKind } from './context';

export interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}
let seq = 0;
export function useToasts() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = (message: string, kind: ToastKind = 'info') => {
    const id = ++seq;
    setItems((cur) => [...cur, { id, message, kind }]);
    setTimeout(() => setItems((cur) => cur.filter((t) => t.id !== id)), kind === 'error' ? 8000 : 4000);
  };
  const dismiss = (id: number) => setItems((cur) => cur.filter((t) => t.id !== id));
  return { items, push, dismiss };
}

export function Toasts({
  items,
  dismiss,
  closeLabel,
}: {
  items: ToastItem[];
  dismiss: (id: number) => void;
  closeLabel: string;
}) {
  // aria-live region stays mounted so announcements work
  const [live, setLive] = useState('');
  useEffect(() => {
    const last = items[items.length - 1];
    if (last) setLive(last.message);
  }, [items]);
  return (
    <div class="adm-toasts">
      <p class="sr-only" role="status" aria-live="polite">
        {live}
      </p>
      {items.map((t) => (
        <div key={t.id} class={`adm-toast adm-toast--${t.kind}`}>
          <span>{t.message}</span>
          <button type="button" class="adm-toast__x" onClick={() => dismiss(t.id)} aria-label={closeLabel}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
