import type { CSSProperties } from 'react';
import { CloseIcon, InfoCircleIcon } from './Icons';
import type { ServerBannerState } from '../types/serverStatus';

interface ServerStatusBannerProps {
  banner: ServerBannerState;
  onOpenHelp: () => void;
  onDismiss: () => void;
}

function getBannerStyle(tone: ServerBannerState['tone']): CSSProperties {
  if (tone === 'danger') {
    return {
      boxShadow: 'inset 4px 0 0 var(--cc-danger)',
      background: 'color-mix(in srgb, var(--cc-danger) 10%, var(--cc-bg-panel) 90%)',
    };
  }

  return {
    boxShadow: 'inset 4px 0 0 var(--cc-warning)',
    background: 'color-mix(in srgb, var(--cc-warning) 10%, var(--cc-bg-panel) 90%)',
  };
}

function getAccentColor(tone: ServerBannerState['tone']): string {
  return tone === 'danger' ? 'var(--cc-danger)' : 'var(--cc-warning)';
}

export default function ServerStatusBanner({
  banner,
  onOpenHelp,
  onDismiss,
}: ServerStatusBannerProps) {
  const accentColor = getAccentColor(banner.tone);

  return (
    <div
      className="cc-divider flex items-start gap-3 border-b px-4 py-3 sm:px-5"
      style={getBannerStyle(banner.tone)}
      role="status"
      aria-live="polite"
    >
      <InfoCircleIcon
        className="mt-0.5 h-4 w-4 shrink-0"
        style={{ color: accentColor }}
      />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold" style={{ color: accentColor }}>
          {banner.title}
        </div>
        <p className="cc-text-secondary mt-1 text-xs leading-relaxed">
          {banner.message}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          onClick={onOpenHelp}
          className="cc-button-secondary cursor-pointer rounded-md px-2.5 py-1 text-[11px] font-medium"
        >
          View Status
        </button>
        <button
          onClick={onDismiss}
          aria-label="Dismiss status warning"
          title="Dismiss status warning"
          className="cc-icon-button cursor-pointer rounded-md p-1.5"
        >
          <CloseIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
