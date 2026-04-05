import { FilePlusIcon, FolderPlusIcon } from './Icons';

interface FileExplorerHeaderProps {
  onCreateFile: () => void;
  onCreateFolder: () => void;
}

export default function FileExplorerHeader({
  onCreateFile,
  onCreateFolder,
}: FileExplorerHeaderProps) {
  return (
    <div className="cc-divider flex items-center justify-between border-b px-3 py-2">
      <span className="cc-section-label text-[10px] font-semibold">
        Explorer
      </span>
      <div className="flex items-center gap-0.5">
        <button
          onClick={onCreateFile}
          title="New File (Alt+N)"
          className="cc-icon-button cursor-pointer rounded p-1"
        >
          <FilePlusIcon className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onCreateFolder}
          title="New Folder (Alt+Shift+N)"
          className="cc-icon-button cursor-pointer rounded p-1"
        >
          <FolderPlusIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
