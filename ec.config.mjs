// @ts-check
import { defineEcConfig } from 'astro-expressive-code';

/** Expressive Code renders all code blocks: in markdown and via the <Code> component. */
export default defineEcConfig({
  themes: ['github-dark', 'github-light'],
  // Follow the site theme toggle, falling back to the OS preference.
  themeCssSelector: theme => `:root[data-theme="${theme.type}"]`,
  useDarkModeMediaQuery: true,
  styleOverrides: {
    borderRadius: '0.5rem',
    codeFontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
    codeFontSize: '0.875rem',
    uiFontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
  },
});
