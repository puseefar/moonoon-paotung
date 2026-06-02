import { create } from 'zustand';
import { Appearance } from 'react-native';

type ThemeMode = 'light' | 'dark' | 'system';

type SettingsStore = {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  getEffectiveTheme: () => 'light' | 'dark';
};

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  themeMode: 'system',

  setThemeMode: (mode) => set({ themeMode: mode }),

  getEffectiveTheme: () => {
    const { themeMode } = get();
    if (themeMode === 'system') {
      return Appearance.getColorScheme() ?? 'light';
    }
    return themeMode;
  },
}));
