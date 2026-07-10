import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_DISPLAY_SETTINGS,
  TEXT_SIZE_SCALE,
  getDisplaySettingsUpdateFromMessage,
  getInitialDisplaySettings,
  applyDisplaySettings,
  normalizeAccent,
  normalizeTextSize,
  normalizeTheme,
  type QdnDisplaySettings,
} from './displaySettings';

const current: QdnDisplaySettings = {
  accent: 'blue',
  textSize: 'medium',
  theme: 'dark',
};

describe('display settings', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes supported values', () => {
    expect(normalizeTheme('LIGHT')).toBe('light');
    expect(normalizeAccent('Cyan')).toBe('cyan');
    expect(normalizeTextSize('extra-large')).toBe('extra-large');
    expect(normalizeTextSize('HUGE')).toBe('huge');
  });

  it('rejects unsupported values', () => {
    expect(normalizeTheme('system')).toBeNull();
    expect(normalizeAccent('mauve')).toBeNull();
    expect(normalizeTextSize('extra-huge')).toBeNull();
  });

  it('uses the Qortium Home and qortium-chat text scale values', () => {
    expect(TEXT_SIZE_SCALE).toEqual({
      'extra-small': 0.88,
      small: 0.94,
      medium: 1,
      large: 1.3,
      'extra-large': 1.7,
      huge: 2.1,
    });
  });

  it('defaults to dark and blue outside Home', () => {
    vi.stubGlobal('window', {
      location: {
        search: '',
      },
    });

    expect(getInitialDisplaySettings()).toEqual(DEFAULT_DISPLAY_SETTINGS);
  });

  it('reads initial values from QDN globals', () => {
    vi.stubGlobal('window', {
      _qdnAccent: 'yellow',
      _qdnTextSize: 'large',
      _qdnTheme: 'light',
      location: {
        search: '',
      },
    });

    expect(getInitialDisplaySettings()).toEqual({
      accent: 'yellow',
      textSize: 'large',
      theme: 'light',
    });
  });

  it('prefers query params over QDN globals', () => {
    vi.stubGlobal('window', {
      _qdnAccent: 'yellow',
      _qdnTextSize: 'small',
      _qdnTheme: 'light',
      location: {
        search: '?theme=dark&accent=red&textSize=huge',
      },
    });

    expect(getInitialDisplaySettings()).toEqual({
      accent: 'red',
      textSize: 'huge',
      theme: 'dark',
    });
  });

  it('updates from Home display messages', () => {
    expect(getDisplaySettingsUpdateFromMessage({ action: 'THEME_CHANGED', requestedHandler: 'UI', theme: 'light' }, current)).toEqual({
      accent: 'blue',
      textSize: 'medium',
      theme: 'light',
    });
    expect(getDisplaySettingsUpdateFromMessage({ action: 'TEXT_SIZE_CHANGED', requestedHandler: 'UI', textSize: 'extra-large' }, current)).toEqual({
      accent: 'blue',
      textSize: 'extra-large',
      theme: 'dark',
    });
    expect(getDisplaySettingsUpdateFromMessage({ action: 'ACCENT_CHANGED', qdnAccent: 'pink' }, current)).toEqual({
      accent: 'pink',
      textSize: 'medium',
      theme: 'dark',
    });
    expect(
      getDisplaySettingsUpdateFromMessage(
        { action: 'DISPLAY_SETTINGS_CHANGED', qdnAccent: 'teal', qdnTextSize: 'small', qdnTheme: 'light' },
        current,
      ),
    ).toEqual({
      accent: 'teal',
      textSize: 'small',
      theme: 'light',
    });
  });

  it('ignores invalid or unrelated display messages', () => {
    expect(getDisplaySettingsUpdateFromMessage({ action: 'ACCENT_CHANGED', accent: 'mauve' }, current)).toBeNull();
    expect(getDisplaySettingsUpdateFromMessage({ action: 'TEXT_SIZE_CHANGED', textSize: 'extra-huge' }, current)).toBeNull();
    expect(getDisplaySettingsUpdateFromMessage({ action: 'THEME_CHANGED', requestedHandler: 'OTHER', theme: 'light' }, current)).toBeNull();
    expect(getDisplaySettingsUpdateFromMessage({ action: 'LANGUAGE_CHANGED', language: 'en' }, current)).toBeNull();
  });

  it('applies display settings to the document root', () => {
    const root = {
      dataset: {} as Record<string, string>,
      style: {} as Record<string, string>,
    };

    vi.stubGlobal('document', {
      documentElement: root,
    });

    applyDisplaySettings({
      accent: 'purple',
      textSize: 'huge',
      theme: 'light',
    });

    expect(root.dataset).toMatchObject({
      accent: 'purple',
      textSize: 'huge',
      theme: 'light',
    });
    expect(root.style.colorScheme).toBe('light');
  });
});
