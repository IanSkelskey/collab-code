import { HeartIcon, InfoCircleIcon, MonitorIcon } from './Icons';

interface GetInvolvedActionsProps {
  className?: string;
}

// Reusable action buttons for "Get Involved" sections.
// - Stacks vertically on small screens, row on sm+
// - Full-width buttons on small screens, auto width on sm+
export default function GetInvolvedActions({ className = '' }: GetInvolvedActionsProps) {
  return (
    <div className={`flex flex-col sm:flex-row gap-2 mt-1 w-full items-stretch sm:items-center ${className}`}>
      <a
        href="https://github.com/sponsors/IanSkelskey"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-full sm:w-auto justify-center items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-md text-xs font-medium text-zinc-300 bg-zinc-700/60 border border-zinc-600 hover:border-pink-500/50 hover:text-pink-300 transition-colors whitespace-nowrap sm:min-w-[120px]"
      >
        <HeartIcon className="w-3.5 h-3.5 shrink-0 text-pink-500" />
        Sponsor
      </a>

      <a
        href="https://github.com/IanSkelskey/collab-code/issues/new/choose"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-full sm:w-auto justify-center items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-md text-xs font-medium text-zinc-300 bg-zinc-800/80 border border-zinc-700 hover:border-emerald-400/50 hover:text-emerald-300 transition-colors whitespace-nowrap sm:min-w-[140px]"
      >
        <InfoCircleIcon className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
        Bug/Feature Request
      </a>

      <a
        href="https://github.com/IanSkelskey/collab-code"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-full sm:w-auto justify-center items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-md text-xs font-medium text-zinc-300 bg-zinc-800/80 border border-zinc-700 hover:border-blue-400/50 hover:text-blue-300 transition-colors whitespace-nowrap sm:min-w-[100px]"
      >
        <MonitorIcon className="w-3.5 h-3.5 shrink-0 text-blue-400" />
        Contribute
      </a>
    </div>
  );
}
