export const ACCENT_VALUES = ['green', 'blue', 'orange', 'purple', 'red', 'teal', 'cyan', 'pink', 'yellow'] as const;
export const TEXT_SIZE_VALUES = ['extra-small', 'small', 'medium', 'large', 'extra-large', 'huge'] as const;

export type QdnAccent = (typeof ACCENT_VALUES)[number];
export type QdnTheme = 'dark' | 'light';
export type QdnTextSize = (typeof TEXT_SIZE_VALUES)[number];

export const TEXT_SIZE_SCALE = {
  'extra-small': 0.88,
  small: 0.94,
  medium: 1,
  large: 1.3,
  'extra-large': 1.7,
  huge: 2.1,
} as const satisfies Record<QdnTextSize, number>;

export type QdnDisplaySettings = {
  accent: QdnAccent;
  textSize: QdnTextSize;
  theme: QdnTheme;
};

type QdnHostWindow = Window & {
  _qdnAccent?: unknown;
  _qdnTextSize?: unknown;
  _qdnTheme?: unknown;
};

export const DEFAULT_DISPLAY_SETTINGS: QdnDisplaySettings = {
  accent: 'blue',
  textSize: 'medium',
  theme: 'dark',
};

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

export function normalizeTheme(value: unknown): QdnTheme | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  return normalized === 'dark' || normalized === 'light' ? normalized : null;
}

export function normalizeAccent(value: unknown): QdnAccent | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  return ACCENT_VALUES.includes(normalized as QdnAccent) ? (normalized as QdnAccent) : null;
}

export function normalizeTextSize(value: unknown): QdnTextSize | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  return TEXT_SIZE_VALUES.includes(normalized as QdnTextSize) ? (normalized as QdnTextSize) : null;
}

export function getInitialDisplaySettings(): QdnDisplaySettings {
  const hostWindow = typeof window === 'undefined' ? null : (window as QdnHostWindow);
  const query = typeof window === 'undefined' ? null : new URLSearchParams(window.location?.search ?? '');

  return {
    accent:
      normalizeAccent(query?.get('accent') ?? query?.get('qdnAccent') ?? hostWindow?._qdnAccent) ??
      DEFAULT_DISPLAY_SETTINGS.accent,
    theme:
      normalizeTheme(query?.get('theme') ?? query?.get('qdnTheme') ?? hostWindow?._qdnTheme) ??
      DEFAULT_DISPLAY_SETTINGS.theme,
    textSize:
      normalizeTextSize(query?.get('textSize') ?? query?.get('text-size') ?? query?.get('qdnTextSize')) ??
      normalizeTextSize(hostWindow?._qdnTextSize) ??
      DEFAULT_DISPLAY_SETTINGS.textSize,
  };
}

export function applyDisplaySettings(settings: QdnDisplaySettings) {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;

  root.dataset.accent = settings.accent;
  root.dataset.textSize = settings.textSize;
  root.dataset.theme = settings.theme;
  root.style.colorScheme = settings.theme;
}

export function getDisplaySettingsUpdateFromMessage(
  data: unknown,
  current: QdnDisplaySettings,
): QdnDisplaySettings | null {
  if (!isObject(data) || typeof data.action !== 'string') {
    return null;
  }

  if ('requestedHandler' in data && data.requestedHandler !== 'UI') {
    return null;
  }

  switch (data.action) {
    case 'ACCENT_CHANGED': {
      const accent = normalizeAccent(data.accent ?? data.qdnAccent);

      return accent ? { ...current, accent } : null;
    }
    case 'DISPLAY_SETTINGS_CHANGED': {
      return {
        accent: normalizeAccent(data.accent ?? data.qdnAccent) ?? current.accent,
        textSize: normalizeTextSize(data.textSize ?? data.qdnTextSize) ?? current.textSize,
        theme: normalizeTheme(data.theme ?? data.qdnTheme) ?? current.theme,
      };
    }
    case 'TEXT_SIZE_CHANGED': {
      const textSize = normalizeTextSize(data.textSize ?? data.qdnTextSize);

      return textSize ? { ...current, textSize } : null;
    }
    case 'THEME_CHANGED': {
      const theme = normalizeTheme(data.theme ?? data.qdnTheme);

      return theme ? { ...current, theme } : null;
    }
    default:
      return null;
  }
}
