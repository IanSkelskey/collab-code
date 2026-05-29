import { useEffect, useRef, type ReactNode } from 'react';
import './ModalOverlay.css';

interface ModalOverlayProps {
  onClose: () => void;
  children: ReactNode;
}

export default function ModalOverlay({ onClose, children }: ModalOverlayProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Open as a native modal: showModal() gives a focus trap, Escape handling,
  // and dialog/aria-modal semantics for free. Open/closed state is owned by the
  // parent (it stops rendering this component to close), so we close on unmount
  // to hand focus back to whatever opened the dialog.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) {
      dialog.showModal();
    }
    return () => {
      if (dialog.open) {
        dialog.close();
      }
    };
  }, []);

  // Escape fires a `cancel` event before the native close; preventing the
  // default keeps the parent's React state the single source of truth.
  const handleCancel = (event: React.SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    onClose();
  };

  // A click on the dialog element itself (the area around the content card)
  // is a backdrop click — dismiss, matching the previous overlay behavior.
  // Keyboard dismissal is handled natively by Escape via onCancel.
  const handleClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    if (event.target === dialogRef.current) {
      onClose();
    }
  };

  return (
    // Backdrop click-to-dismiss; keyboard dismissal is handled natively by
    // Escape (via onCancel), so a separate key handler here is redundant.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={dialogRef}
      onCancel={handleCancel}
      onClick={handleClick}
      className="cc-overlay cc-modal-dialog fixed inset-0 z-[100] flex items-center justify-center"
    >
      {children}
    </dialog>
  );
}
