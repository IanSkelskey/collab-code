import { createContext } from 'react';
import type { AppThemeDefinition, AppearancePreference } from './themes';

export interface ThemeContextValue {
  appearance: AppearancePreference;
  theme: AppThemeDefinition;
  setAppearance: (appearance: AppearancePreference) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);
