import { Injectable, signal, computed } from '@angular/core';

export type Theme = 'light' | 'dark' | 'ocean' | 'forest' | 'sunset';

const THEME_LABELS: Record<Theme, string> = {
  light: 'Light', dark: 'Dark', ocean: 'Ocean', forest: 'Forest', sunset: 'Sunset'
};

const THEMES: Theme[] = ['light', 'dark', 'ocean', 'forest', 'sunset'];

function initialTheme(): Theme {
  const saved = localStorage.getItem('dashboard-theme') as Theme | null;
  if (saved && THEMES.includes(saved)) return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  themes = THEMES;
  theme = signal<Theme>(initialTheme());
  label = computed(() => THEME_LABELS[this.theme()]);

  constructor() {
    document.documentElement.setAttribute('data-theme', this.theme());
  }

  set(name: Theme): void {
    this.theme.set(name);
    document.documentElement.setAttribute('data-theme', name);
    localStorage.setItem('dashboard-theme', name);
  }
}
