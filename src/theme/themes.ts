import type { ITerminalOptions } from '@xterm/xterm';

export type ThemePickerIcon = 'sun' | 'moon';
export type AppearancePreference = 'system' | 'light' | 'dark';

export interface AppThemeDefinition {
  id: string;
  label: string;
  colorScheme: 'light' | 'dark';
  pickerIcon: ThemePickerIcon;
  cssVars: Record<string, string>;
  monacoTheme: string;
  terminalTheme: NonNullable<ITerminalOptions['theme']>;
}

const darkTheme: AppThemeDefinition = {
  id: 'cc-dark',
  label: 'CC Dark',
  colorScheme: 'dark',
  pickerIcon: 'moon',
  monacoTheme: 'collab-code-dark',
  cssVars: {
    '--cc-bg-app': '#0b1118',
    '--cc-bg-app-glow': 'rgba(56, 189, 248, 0.12)',
    '--cc-bg-panel': '#101925',
    '--cc-bg-panel-alt': '#142030',
    '--cc-bg-elevated': '#1a2637',
    '--cc-bg-canvas': '#0d1520',
    '--cc-bg-input': '#12202f',
    '--cc-bg-hover': 'rgba(148, 163, 184, 0.1)',
    '--cc-bg-hover-strong': 'rgba(148, 163, 184, 0.14)',
    '--cc-bg-selection': 'rgba(52, 211, 153, 0.16)',
    '--cc-bg-selection-strong': 'rgba(52, 211, 153, 0.3)',
    '--cc-bg-terminal': '#08121b',
    '--cc-bg-terminal-header': '#101b29',
    '--cc-bg-markdown': '#101822',
    '--cc-bg-markdown-paper': '#111c29',
    '--cc-text-primary': '#e8eef6',
    '--cc-text-secondary': '#cad5e2',
    '--cc-text-muted': '#94a3b8',
    '--cc-text-faint': '#677489',
    '--cc-text-inverse': '#081018',
    '--cc-border': '#304055',
    '--cc-border-strong': '#41516a',
    '--cc-border-soft': 'rgba(65, 81, 106, 0.56)',
    '--cc-accent': '#34d399',
    '--cc-accent-strong': '#10b981',
    '--cc-accent-contrast': '#05150f',
    '--cc-link': '#67e8f9',
    '--cc-success': '#34d399',
    '--cc-warning': '#fbbf24',
    '--cc-danger': '#f87171',
    '--cc-danger-button-bg': '#dc2626',
    '--cc-danger-button-hover': '#b91c1c',
    '--cc-danger-button-contrast': '#ffffff',
    '--cc-backdrop': 'rgba(2, 6, 12, 0.64)',
    '--cc-shadow-sm': '0 8px 20px rgba(3, 8, 18, 0.18)',
    '--cc-shadow-md': '0 16px 36px rgba(3, 8, 18, 0.28)',
    '--cc-shadow-lg': '0 28px 56px rgba(3, 8, 18, 0.42)',
    '--cc-scrollbar': 'rgba(103, 116, 139, 0.56)',
    '--cc-scrollbar-hover': 'rgba(148, 163, 184, 0.82)',
  },
  terminalTheme: {
    background: '#08121b',
    foreground: '#dce6f3',
    cursor: '#34d399',
    cursorAccent: '#08121b',
    selectionBackground: '#21405a',
    black: '#111827',
    red: '#f87171',
    green: '#34d399',
    yellow: '#fbbf24',
    blue: '#60a5fa',
    magenta: '#c084fc',
    cyan: '#67e8f9',
    white: '#e5e7eb',
    brightBlack: '#76808f',
    brightRed: '#fca5a5',
    brightGreen: '#6ee7b7',
    brightYellow: '#fcd34d',
    brightBlue: '#93c5fd',
    brightMagenta: '#d8b4fe',
    brightCyan: '#a5f3fc',
    brightWhite: '#f8fafc',
  },
};

const lightTheme: AppThemeDefinition = {
  id: 'cc-light',
  label: 'CC Light',
  colorScheme: 'light',
  pickerIcon: 'sun',
  monacoTheme: 'collab-code-light',
  cssVars: {
    '--cc-bg-app': '#eef4fa',
    '--cc-bg-app-glow': 'rgba(56, 189, 248, 0.18)',
    '--cc-bg-panel': '#f9fbfe',
    '--cc-bg-panel-alt': '#f3f7fc',
    '--cc-bg-elevated': '#ffffff',
    '--cc-bg-canvas': '#eaf0f7',
    '--cc-bg-input': '#f8fbff',
    '--cc-bg-hover': 'rgba(15, 23, 42, 0.06)',
    '--cc-bg-hover-strong': 'rgba(15, 23, 42, 0.09)',
    '--cc-bg-selection': 'rgba(16, 185, 129, 0.14)',
    '--cc-bg-selection-strong': 'rgba(16, 185, 129, 0.26)',
    '--cc-bg-terminal': '#fbfdff',
    '--cc-bg-terminal-header': '#edf3fb',
    '--cc-bg-markdown': '#f1f6fc',
    '--cc-bg-markdown-paper': '#ffffff',
    '--cc-text-primary': '#162334',
    '--cc-text-secondary': '#2d4056',
    '--cc-text-muted': '#58697f',
    '--cc-text-faint': '#7d8ca1',
    '--cc-text-inverse': '#ffffff',
    '--cc-border': '#cad7e5',
    '--cc-border-strong': '#afc0d4',
    '--cc-border-soft': 'rgba(148, 163, 184, 0.44)',
    '--cc-accent': '#047857',
    '--cc-accent-strong': '#065f46',
    '--cc-accent-contrast': '#ffffff',
    '--cc-link': '#0f766e',
    '--cc-success': '#059669',
    '--cc-warning': '#d97706',
    '--cc-danger': '#dc2626',
    '--cc-danger-button-bg': '#dc2626',
    '--cc-danger-button-hover': '#b91c1c',
    '--cc-danger-button-contrast': '#ffffff',
    '--cc-backdrop': 'rgba(15, 23, 42, 0.18)',
    '--cc-shadow-sm': '0 10px 22px rgba(15, 23, 42, 0.08)',
    '--cc-shadow-md': '0 18px 36px rgba(15, 23, 42, 0.12)',
    '--cc-shadow-lg': '0 28px 56px rgba(15, 23, 42, 0.16)',
    '--cc-scrollbar': 'rgba(100, 116, 139, 0.38)',
    '--cc-scrollbar-hover': 'rgba(71, 85, 105, 0.62)',
  },
  terminalTheme: {
    background: '#fbfdff',
    foreground: '#1f2937',
    cursor: '#047857',
    cursorAccent: '#fbfdff',
    selectionBackground: '#cfe5ff',
    black: '#0f172a',
    red: '#b91c1c',
    green: '#047857',
    yellow: '#92400e',
    blue: '#1d4ed8',
    magenta: '#7e22ce',
    cyan: '#0f766e',
    white: '#334155',
    brightBlack: '#475569',
    brightRed: '#991b1b',
    brightGreen: '#166534',
    brightYellow: '#854d0e',
    brightBlue: '#1e40af',
    brightMagenta: '#6b21a8',
    brightCyan: '#155e75',
    brightWhite: '#0f172a',
  },
};

export const themeDefinitions = [darkTheme, lightTheme] as const;

export type ThemeId = (typeof themeDefinitions)[number]['id'];

const themeMap = new Map(themeDefinitions.map((theme) => [theme.id, theme]));
const appearanceThemeMap = {
  light: 'cc-light',
  dark: 'cc-dark',
} as const satisfies Record<Exclude<AppearancePreference, 'system'>, ThemeId>;
const legacyThemeIdMap = {
  dark: 'cc-dark',
  light: 'cc-light',
} as const satisfies Record<string, ThemeId>;

export const defaultThemeId: ThemeId = 'cc-dark';
export const defaultAppearancePreference: AppearancePreference = 'system';
export const appearanceStorageKey = 'collab-code-appearance';
export const themeStorageKey = 'collab-code-theme';

export function isThemeId(value: string): value is ThemeId {
  return themeMap.has(value);
}

export function resolveThemeId(themeId: string | null | undefined): ThemeId | null {
  if (!themeId) {
    return null;
  }

  if (isThemeId(themeId)) {
    return themeId;
  }

  if (themeId in legacyThemeIdMap) {
    return legacyThemeIdMap[themeId as keyof typeof legacyThemeIdMap];
  }

  return null;
}

export function resolveAppearancePreference(value: string | null | undefined): AppearancePreference | null {
  if (!value) {
    return null;
  }

  if (value === 'system' || value === 'auto') {
    return 'system';
  }

  if (value === 'light' || value === 'dark') {
    return value;
  }

  const resolvedThemeId = resolveThemeId(value);
  if (resolvedThemeId === 'cc-light') {
    return 'light';
  }

  if (resolvedThemeId === 'cc-dark') {
    return 'dark';
  }

  return null;
}

export function getThemeIdForAppearance(
  appearance: AppearancePreference,
  systemThemeId: ThemeId,
): ThemeId {
  if (appearance === 'system') {
    return systemThemeId;
  }

  return appearanceThemeMap[appearance];
}

export function getThemeDefinition(themeId: string | null | undefined): AppThemeDefinition {
  const resolvedThemeId = resolveThemeId(themeId);
  if (resolvedThemeId) {
    return themeMap.get(resolvedThemeId)!;
  }

  return themeMap.get(defaultThemeId)!;
}
