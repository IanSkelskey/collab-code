import ModalOverlay from './ModalOverlay';
import { roomTemplates, type RoomTemplateId } from '../config/roomTemplates';

interface RoomTemplateDialogProps {
  onSelect: (templateId: RoomTemplateId) => void;
  onClose: () => void;
}

export default function RoomTemplateDialog({ onSelect, onClose }: RoomTemplateDialogProps) {
  return (
    <ModalOverlay onClose={onClose}>
      <div className="cc-card w-[420px] max-w-[92vw] overflow-hidden rounded-lg">
        <div className="cc-divider border-b px-4 py-3 sm:px-5">
          <h3 className="cc-text-primary text-sm font-semibold">Choose a room starter</h3>
          <p className="cc-text-muted mt-1 text-xs leading-relaxed">
            Start with Java, start with Python, or open a blank room and choose inside the editor.
          </p>
        </div>

        <div className="grid gap-2 px-4 py-4 sm:px-5">
          {roomTemplates.map((template) => (
            <button
              key={template.id}
              onClick={() => onSelect(template.id)}
              className="cc-panel hover:border-[var(--cc-accent)] hover:bg-[var(--cc-bg-hover)] w-full cursor-pointer rounded-lg border px-4 py-3 text-left transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="cc-text-primary text-sm font-semibold">{template.label}</span>
                <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--cc-accent)]">
                  Select
                </span>
              </div>
              <p className="cc-text-secondary mt-1 text-xs">{template.description}</p>
              <p className="cc-text-faint mt-1 text-[11px]">{template.helper}</p>
            </button>
          ))}
        </div>

        <div className="cc-divider flex justify-end border-t px-4 py-3 sm:px-5">
          <button
            onClick={onClose}
            className="cc-button-secondary cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
