import { useEffect, useRef, useState } from 'react';
import { CloseIcon, InfoCircleIcon, UndoIcon } from './Icons';
import type { AppToast } from '../types/toast';

const TOAST_DURATION = 5000;
const INFO_TOAST_DURATION = 2500;

export default function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: AppToast[];
  onDismiss: (id: number) => void;
})  {
  return (
    <div
      className="fixed right-3 bottom-3 z-[100] flex flex-col gap-2 items-end pointer-events-none sm:right-4 sm:bottom-4"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: AppToast;
  onDismiss: (id: number) => void;
}) {
  const [progress, setProgress] = useState(100);
  const startRef = useRef(Date.now());
  const isActionable = Boolean(toast.action);
  const duration = toast.action ? TOAST_DURATION : INFO_TOAST_DURATION;
  const Icon = isActionable ? UndoIcon : InfoCircleIcon;
  const toneClasses = isActionable
    ? {
        badge: 'bg-emerald-500/10 text-emerald-400',
        button: 'border-zinc-600 bg-zinc-700/70 text-emerald-300 hover:border-zinc-500 hover:bg-zinc-600/80 hover:text-emerald-200',
        progress: 'bg-emerald-400/80',
      }
    : {
        badge: 'bg-zinc-700/80 text-zinc-300',
        button: 'border-zinc-600 bg-zinc-700/70 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-600/80 hover:text-zinc-100',
        progress: 'bg-zinc-500/70',
      };

  useEffect(() => {
    const frame = () => {
      const elapsed = Date.now() - startRef.current;
      const pct = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(pct);
      if (pct > 0) raf = requestAnimationFrame(frame);
    };
    let raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [duration]);

  const handleAction = () => {
    toast.action?.onAction();
    onDismiss(toast.id);
  };

  return (
    <div className="pointer-events-auto w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-lg border border-zinc-700 bg-[#1e2030] shadow-xl shadow-black/40 animate-[toastIn_180ms_ease-out]">
      <div className="px-3 py-2.5">
        <div className="flex items-start gap-2.5">
          <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${toneClasses.badge}`}>
            <Icon className="h-3.5 w-3.5" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="pt-0.5 text-xs leading-relaxed text-zinc-200 break-words">
              {toast.label}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {toast.action && (
              <button
                onClick={handleAction}
                className={`rounded-md border px-2 py-1 text-[10px] font-medium transition-colors cursor-pointer ${toneClasses.button}`}
              >
                {toast.action.label}
              </button>
            )}
            <button
              onClick={() => onDismiss(toast.id)}
              aria-label="Dismiss notification"
              className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-700/60 hover:text-zinc-200 transition-colors cursor-pointer"
            >
              <CloseIcon className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      <div className="h-[2px] bg-zinc-800/90">
        <div
          className={`h-full origin-left ${toneClasses.progress}`}
          style={{ transform: `scaleX(${progress / 100})` }}
        />
      </div>
    </div>
  );
}
