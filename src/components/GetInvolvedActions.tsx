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
        className="cc-button-secondary inline-flex w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium sm:min-w-[120px] sm:w-auto sm:px-4"
      >
        <HeartIcon className="w-3.5 h-3.5 shrink-0 text-pink-500" />
        Sponsor
      </a>

      <a
        href="https://github.com/IanSkelskey/collab-code/issues/new/choose"
        target="_blank"
        rel="noopener noreferrer"
        className="cc-button-secondary inline-flex w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium sm:min-w-[140px] sm:w-auto sm:px-4"
      >
        <InfoCircleIcon className="h-3.5 w-3.5 shrink-0 text-[var(--cc-accent)]" />
        Bug/Feature Request
      </a>

      <a
        href="https://github.com/IanSkelskey/collab-code"
        target="_blank"
        rel="noopener noreferrer"
        className="cc-button-secondary inline-flex w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium sm:min-w-[100px] sm:w-auto sm:px-4"
      >
        <MonitorIcon className="w-3.5 h-3.5 shrink-0 text-blue-400" />
        Contribute
      </a>
    </div>
  );
}
