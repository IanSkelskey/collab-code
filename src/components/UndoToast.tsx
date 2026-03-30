import { useEffect, useRef, useState } from 'react';

export interface UndoToast {
  id: number;
  label: string;
  onUndo?: () => void;
}

const TOAST_DURATION = 5000;
const INFO_TOAST_DURATION = 2500;

export default function UndoToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: UndoToast[];
  onDismiss: (id: number) => void;
})  {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center pointer-events-none">
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
  toast: UndoToast;
  onDismiss: (id: number) => void;
}) {
  const [progress, setProgress] = useState(100);
  const startRef = useRef(Date.now());
  const duration = toast.onUndo ? TOAST_DURATION : INFO_TOAST_DURATION;

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

  const handleUndo = () => {
    toast.onUndo?.();
    onDismiss(toast.id);
  };

  return (
    <div className="pointer-events-auto bg-[#1e2030] border border-zinc-700 rounded-lg shadow-2xl shadow-black/60 px-3 py-2 flex items-center gap-3 min-w-[260px] max-w-[90vw] relative overflow-hidden animate-[slideUp_0.2s_ease-out]">
      <span className="text-xs text-zinc-300 flex-1 truncate">{toast.label}</span>
      {toast.onUndo && (
        <button
          onClick={handleUndo}
          className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer shrink-0"
        >
          Undo
        </button>
      )}
      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 h-[2px] bg-emerald-500/60 transition-none" style={{ width: `${progress}%` }} />
    </div>
  );
}
