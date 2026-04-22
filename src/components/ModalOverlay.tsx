import { useEffect, type ReactNode } from 'react';

interface ModalOverlayProps {
  onClose: () => void;
  children: ReactNode;
}

export default function ModalOverlay({ onClose, children }: ModalOverlayProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    // Backdrop click-to-close; keyboard dismissal is handled by the
    // window-level Escape listener above, so a key handler here is redundant.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      onClick={handleBackdrop}
      className="cc-overlay fixed inset-0 z-[100] flex items-center justify-center"
    >
      {children}
    </div>
  );
}
