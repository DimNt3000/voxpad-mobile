/**
 * The Voxpad palette, same tokens as the web app: warm neutrals with one
 * terracotta accent, tuned so text is at least 4.5:1 and control borders at
 * least 3:1 against their backgrounds in both themes.
 */

export interface Theme {
  bg: string;
  bgSunk: string;
  surface: string;
  ink: string;
  inkSoft: string;
  inkFaint: string;
  line: string;
  lineStrong: string;
  accent: string;
  accentInk: string;
  accentWash: string;
  hlSentence: string;
  hlWord: string;
  hlWordInk: string;
}

export const LIGHT: Theme = {
  bg: '#f6f4ef',
  bgSunk: '#efece5',
  surface: '#ffffff',
  ink: '#1b1a17',
  inkSoft: '#55534c',
  inkFaint: '#6b685f',
  line: '#dcd8ce',
  lineStrong: '#8f897b',
  accent: '#a8431d',
  accentInk: '#ffffff',
  accentWash: '#f3e3db',
  hlSentence: '#efe4cf',
  hlWord: '#d9a441',
  hlWordInk: '#17150f',
};

export const DARK: Theme = {
  bg: '#131311',
  bgSunk: '#0e0e0d',
  surface: '#1c1c19',
  ink: '#eceae4',
  inkSoft: '#b0ada4',
  inkFaint: '#97948b',
  line: '#2e2e29',
  lineStrong: '#726f64',
  accent: '#e07a4f',
  accentInk: '#1b1a17',
  accentWash: '#33241d',
  hlSentence: '#2c2a22',
  hlWord: '#b98428',
  hlWordInk: '#17150f',
};

export const themeFor = (scheme: 'light' | 'dark'): Theme =>
  scheme === 'dark' ? DARK : LIGHT;
