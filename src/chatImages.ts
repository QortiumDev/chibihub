import { qdnRequest } from './qdnRequest';
import type { QortalChatImageRef } from './types';

const QORTAL_CHAT_IMAGE_MAX_BYTES = 6 * 1024 * 1024;
const MAX_CONCURRENT_IMAGE_FETCHES = 3;

const cache = new Map<string, Promise<string | null>>();
let activeFetches = 0;
const queue: Array<() => void> = [];

function cacheKey(image: QortalChatImageRef) {
  return `${image.service}/${image.name}/${image.identifier}`;
}

function schedule<T>(task: () => Promise<T>) {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      activeFetches += 1;
      task()
        .then(resolve, reject)
        .finally(() => {
          activeFetches -= 1;
          queue.shift()?.();
        });
    };

    if (activeFetches < MAX_CONCURRENT_IMAGE_FETCHES) {
      run();
    } else {
      queue.push(run);
    }
  });
}

function getImageDataUrl(value: unknown) {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  const body = typeof record?.body === 'string' ? record.body.trim() : '';
  const encoding = typeof record?.encoding === 'string' ? record.encoding.toLowerCase() : '';
  const contentType = typeof record?.contentType === 'string' && record.contentType ? record.contentType : 'image/png';

  if (!body || encoding !== 'base64') {
    return null;
  }

  return `data:${contentType};base64,${body}`;
}

export function loadChatImage(image: QortalChatImageRef) {
  const key = cacheKey(image);
  const cached = cache.get(key);

  if (cached) {
    return cached;
  }

  const promise = schedule(async () => {
    try {
      return getImageDataUrl(
        await qdnRequest({
          action: 'FETCH_QORTAL_RESOURCE',
          identifier: image.identifier,
          maxBytes: QORTAL_CHAT_IMAGE_MAX_BYTES,
          name: image.name,
          service: image.service,
        }),
      );
    } catch {
      return null;
    }
  });

  cache.set(key, promise);

  return promise;
}

export function resetChatImageCacheForTest() {
  cache.clear();
  activeFetches = 0;
  queue.length = 0;
}
