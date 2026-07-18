import { hasAction } from './account';
import { qdnRequest } from './qdnRequest';
import type { BridgeState } from './types';

export type QortalNodeContext = {
  isLocal: boolean;
  label: 'Local Qortal node' | 'Public Qortal node';
  origin: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function getQortalNodeContextFromResourceUrl(value: unknown): QortalNodeContext {
  const resourceUrl = isRecord(value) && typeof value.url === 'string' ? value.url.trim() : '';

  if (!resourceUrl) {
    throw new Error('Qortal node URL was not returned.');
  }

  const url = new URL(resourceUrl);

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Qortal node URL must use HTTP or HTTPS.');
  }

  const hostname = url.hostname.toLocaleLowerCase();
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';

  return {
    isLocal,
    label: isLocal ? 'Local Qortal node' : 'Public Qortal node',
    origin: url.origin,
  };
}

export async function loadQortalNodeContext(bridgeState: BridgeState): Promise<QortalNodeContext> {
  if (!hasAction(bridgeState.actions, 'GET_QORTAL_RESOURCE_URL')) {
    throw new Error('This Home build cannot report which Qortal node is serving app data.');
  }

  const result = await qdnRequest({
    action: 'GET_QORTAL_RESOURCE_URL',
    identifier: 'node_probe',
    name: 'Qortal',
    service: 'THUMBNAIL',
  });

  return getQortalNodeContextFromResourceUrl(result);
}
