import { useTheme } from '../theme/useTheme';
import type { AppearancePreference } from '../theme/themes';
import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from './Icons';
import './ThemePicker.css';

interface ThemePickerProps {
  compact?: boolean;
  className?: string;
}

const themeChoices = [
  { id: 'light', label: 'Light', Icon: SunIcon },
  { id: 'dark', label: 'Dark', Icon: MoonIcon },
] as const satisfies ReadonlyArray<{
  id: Exclude<AppearancePreference, 'system'>;
  label: string;
  Icon: typeof SunIcon;
}>;

export default function ThemePicker({ compact = false, className = '' }: ThemePickerProps) {
  const { appearance, theme, setAppearance } = useTheme();
  const autoEnabled = appearance === 'system';
  const effectiveAppearance: Exclude<AppearancePreference, 'system'> = autoEnabled
    ? theme.colorScheme
    : appearance;

  const handleAutoChange = (enabled: boolean) => {
    if (enabled) {
      setAppearance('system');
      return;
    }

    setAppearance(effectiveAppearance);
  };

  return (
    <div
      className={`cc-theme-picker ${compact ? 'cc-theme-picker-compact' : ''} ${className}`.trim()}
    >
      <div className="cc-theme-switch" role="radiogroup" aria-label="Select appearance">
        {themeChoices.map((option) => {
          const isActive = option.id === effectiveAppearance;

          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={isActive}
              title={`Use ${option.label} appearance`}
              onClick={() => setAppearance(option.id)}
              className={`cc-theme-choice ${isActive ? 'cc-theme-choice-active' : ''}`}
            >
              <option.Icon className="cc-theme-choice-icon" />
              {!compact && <span className="cc-theme-choice-label">{option.label}</span>}
            </button>
          );
        })}
      </div>

      <label className={`cc-theme-auto ${autoEnabled ? 'cc-theme-auto-active' : ''}`}>
        <input
          type="checkbox"
          checked={autoEnabled}
          onChange={(event) => handleAutoChange(event.target.checked)}
          className="cc-theme-auto-input"
        />
        <span
          className={`cc-theme-auto-box ${autoEnabled ? 'cc-theme-auto-box-checked' : ''}`}
          aria-hidden="true"
        >
          {autoEnabled && <CheckIcon className="cc-theme-auto-check" />}
        </span>
        <MonitorIcon className="cc-theme-auto-icon" />
        {compact ? (
          <span className="cc-theme-auto-title">Auto</span>
        ) : (
          <span className="cc-theme-auto-copy">
            <span className="cc-theme-auto-title">Auto</span>
            <span className="cc-theme-auto-subtitle">Follow your system theme</span>
          </span>
        )}
      </label>

      {!compact && (
        <p className="cc-theme-status" aria-live="polite">
          {autoEnabled
            ? `Currently following ${theme.colorScheme} mode.`
            : `Locked to ${effectiveAppearance} mode.`}
        </p>
      )}
    </div>
  );
}
