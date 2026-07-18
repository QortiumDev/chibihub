/// <reference types="vite/client" />

import type { QdnRequest } from './qdnRequest';

declare global {
  const __APP_VERSION__: string;

  interface Window {
    _qdnAccent?: unknown;
    _qdnTheme?: unknown;
    qdnRequest?: <T = unknown>(request: QdnRequest) => Promise<T>;
  }
}
