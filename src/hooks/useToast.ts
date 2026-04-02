import { useCallback, useState } from 'react';
import type { AppToast, AppToastAction, PushToast, ToastActionInput } from '../types/toast';

let nextToastId = 0;

function normalizeToastAction(action?: ToastActionInput): AppToastAction | undefined {
  if (!action) {
    return undefined;
  }

  if (typeof action === 'function') {
    return {
      label: 'Undo',
      onAction: action,
    };
  }

  return {
    label: action.label ?? 'Undo',
    onAction: action.onAction,
  };
}

export function useToast() {
  const [toasts, setToasts] = useState<AppToast[]>([]);

  const pushToast = useCallback<PushToast>((label, action) => {
    const id = nextToastId++;
    const nextAction = normalizeToastAction(action);
    const duration = nextAction ? 5000 : 2500;

    setToasts((currentToasts) => [...currentToasts, { id, label, action: nextAction }]);

    window.setTimeout(() => {
      setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== id));
    }, duration);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== id));
  }, []);

  return { toasts, pushToast, dismissToast };
}
