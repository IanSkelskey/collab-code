import { useCallback, useState } from 'react';
import type { UndoToast } from '../components/UndoToast';

let nextToastId = 0;

export function useUndoToast() {
  const [toasts, setToasts] = useState<UndoToast[]>([]);

  const pushToast = useCallback((label: string, onUndo?: () => void) => {
    const id = nextToastId++;
    const duration = onUndo ? 5000 : 2500;

    setToasts((currentToasts) => [...currentToasts, { id, label, onUndo }]);

    window.setTimeout(() => {
      setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== id));
    }, duration);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== id));
  }, []);

  return { toasts, pushToast, dismissToast };
}

