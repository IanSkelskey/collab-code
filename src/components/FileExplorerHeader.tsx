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
    <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700/50">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        Explorer
      </span>
      <div className="flex items-center gap-0.5">
        <button
          onClick={onCreateFile}
          title="New File (Alt+N)"
          className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
        >
          <FilePlusIcon className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onCreateFolder}
          title="New Folder (Alt+Shift+N)"
          className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
        >
          <FolderPlusIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
