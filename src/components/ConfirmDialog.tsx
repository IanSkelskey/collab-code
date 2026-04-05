import { useEffect } from 'react';
import ModalOverlay from './ModalOverlay';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  secondaryLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  onSecondary?: () => void;
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  secondaryLabel,
  onConfirm,
  onCancel,
  onSecondary,
}: ConfirmDialogProps) {
  // Enter to confirm
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') onConfirm();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onConfirm]);

  return (
    <ModalOverlay onClose={onCancel}>
      <div
        className="cc-card w-[380px] max-w-[92vw] rounded-xl p-5"
      >
        <h3 className="cc-text-primary mb-1.5 text-[15px] font-semibold">{title}</h3>
        <p className="cc-text-muted mb-5 text-sm leading-6">{message}</p>
        <div className="flex flex-wrap items-stretch justify-end gap-2.5">
          <button
            onClick={onCancel}
            className="cc-button-secondary min-h-10 cursor-pointer rounded-lg px-4 text-sm font-medium whitespace-nowrap"
          >
            Cancel
          </button>
          {onSecondary && secondaryLabel && (
            <button
              onClick={onSecondary}
              className="cc-button-primary min-h-10 min-w-[9.5rem] flex-1 cursor-pointer rounded-lg px-4 text-sm font-medium whitespace-nowrap"
            >
              {secondaryLabel}
            </button>
          )}
          <button
            onClick={onConfirm}
            className="cc-button-danger min-h-10 cursor-pointer rounded-lg px-4 text-sm font-medium whitespace-nowrap"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
