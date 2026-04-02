import ModalOverlay from './ModalOverlay';
import { roomTemplates, type RoomTemplateId } from '../config/roomTemplates';

interface RoomTemplateDialogProps {
  onSelect: (templateId: RoomTemplateId) => void;
  onClose: () => void;
}

export default function RoomTemplateDialog({ onSelect, onClose }: RoomTemplateDialogProps) {
  return (
    <ModalOverlay onClose={onClose}>
      <div className="w-[420px] max-w-[92vw] rounded-lg border border-zinc-700 bg-[#1e2030] shadow-2xl shadow-black/60 overflow-hidden">
        <div className="border-b border-zinc-700/60 px-4 py-3 sm:px-5">
          <h3 className="text-sm font-semibold text-zinc-100">Choose a room starter</h3>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">
            Start with Java, start with Python, or open a blank room and choose inside the editor.
          </p>
        </div>

        <div className="grid gap-2 px-4 py-4 sm:px-5">
          {roomTemplates.map((template) => (
            <button
              key={template.id}
              onClick={() => onSelect(template.id)}
              className="w-full rounded-lg border border-zinc-700 bg-[#161b22] px-4 py-3 text-left transition-colors hover:border-emerald-500/60 hover:bg-[#1b2130] active:bg-[#202636] cursor-pointer"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-zinc-100">{template.label}</span>
                <span className="text-[10px] uppercase tracking-[0.18em] text-emerald-400">
                  Select
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-300">{template.description}</p>
              <p className="mt-1 text-[11px] text-zinc-500">{template.helper}</p>
            </button>
          ))}
        </div>

        <div className="flex justify-end border-t border-zinc-700/60 px-4 py-3 sm:px-5">
          <button
            onClick={onClose}
            className="rounded-md bg-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-600 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
