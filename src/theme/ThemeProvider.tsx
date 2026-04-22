import { useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import {
  appearanceStorageKey,
  defaultAppearancePreference,
  defaultThemeId,
  getThemeDefinition,
  getThemeIdForAppearance,
  resolveAppearancePreference,
  themeStorageKey,
  type AppThemeDefinition,
  type AppearancePreference,
  type ThemeId,
} from './themes';
import { ThemeContext, type ThemeContextValue } from './themeContext';
import {
  readLocalStorageItem,
  removeLocalStorageItem,
  writeLocalStorageItem,
} from '../lib/localStorage';

function getSystemThemeId(): ThemeId {
  if (typeof window === 'undefined') {
    return defaultThemeId;
  }

  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'cc-light' : 'cc-dark';
}

function getPreferredAppearance(): AppearancePreference {
  if (typeof window === 'undefined') {
    return defaultAppearancePreference;
  }

  const storedAppearance = readLocalStorageItem(appearanceStorageKey);
  const resolvedStoredAppearance = resolveAppearancePreference(storedAppearance);
  if (resolvedStoredAppearance) {
    return resolvedStoredAppearance;
  }

  const legacyStoredTheme = readLocalStorageItem(themeStorageKey);
  const resolvedLegacyAppearance = resolveAppearancePreference(legacyStoredTheme);
  if (resolvedLegacyAppearance) {
    return resolvedLegacyAppearance;
  }

  return defaultAppearancePreference;
}

function applyTheme(theme: AppThemeDefinition): void {
  const root = document.documentElement;
  root.dataset.theme = theme.id;
  root.style.colorScheme = theme.colorScheme;

  for (const [variableName, variableValue] of Object.entries(theme.cssVars)) {
    root.style.setProperty(variableName, variableValue);
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearance] = useState<AppearancePreference>(getPreferredAppearance);
  const [systemThemeId, setSystemThemeId] = useState<ThemeId>(getSystemThemeId);
  const themeId = useMemo(
    () => getThemeIdForAppearance(appearance, systemThemeId),
    [appearance, systemThemeId],
  );
  const theme = useMemo(() => getThemeDefinition(themeId), [themeId]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    const updateSystemTheme = (matches: boolean) => {
      setSystemThemeId(matches ? 'cc-light' : 'cc-dark');
    };

    updateSystemTheme(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      updateSystemTheme(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  useLayoutEffect(() => {
    applyTheme(theme);

    writeLocalStorageItem(appearanceStorageKey, appearance);
    removeLocalStorageItem(themeStorageKey);
  }, [appearance, theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      appearance,
      theme,
      setAppearance,
    }),
    [appearance, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
