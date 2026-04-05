import { useTheme } from '../theme/ThemeProvider';
import type { AppearancePreference } from '../theme/themes';
import { MonitorIcon, MoonIcon, SunIcon } from './Icons';
import './ThemePicker.css';

interface ThemePickerProps {
  compact?: boolean;
  className?: string;
}

const appearanceOptions = [
  { id: 'system', label: 'Auto', Icon: MonitorIcon },
  { id: 'light', label: 'Light', Icon: SunIcon },
  { id: 'dark', label: 'Dark', Icon: MoonIcon },
] as const satisfies ReadonlyArray<{
  id: AppearancePreference;
  label: string;
  Icon: typeof SunIcon;
}>;

export default function ThemePicker({
  compact = false,
  className = '',
}: ThemePickerProps) {
  const { appearance, setAppearance } = useTheme();

  return (
    <div
      className={`cc-theme-picker ${compact ? 'cc-theme-picker-compact' : ''} ${className}`.trim()}
      role="group"
      aria-label="Select appearance"
    >
      {appearanceOptions.map((option) => {
        const isActive = option.id === appearance;

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => setAppearance(option.id)}
            title={`Use ${option.label} appearance`}
            aria-pressed={isActive}
            className={`cc-theme-option ${isActive ? 'cc-theme-option-active' : ''}`}
          >
            <span className="cc-theme-icon-wrap" aria-hidden="true">
              <option.Icon className="cc-theme-icon" />
            </span>
            {!compact && <span className="truncate">{option.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
