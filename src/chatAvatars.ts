import { qdnRequest } from './qdnRequest';

const QORTAL_AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const MAX_CONCURRENT_AVATAR_FETCHES = 3;

const cache = new Map<string, Promise<string | null>>();
let activeFetches = 0;
const queue: Array<() => void> = [];

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

    if (activeFetches < MAX_CONCURRENT_AVATAR_FETCHES) {
      run();
    } else {
      queue.push(run);
    }
  });
}

function getAvatarDataUrl(value: unknown) {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  const body = typeof record?.body === 'string' ? record.body.trim() : '';
  const encoding = typeof record?.encoding === 'string' ? record.encoding.toLowerCase() : '';
  const contentType = typeof record?.contentType === 'string' && record.contentType ? record.contentType : 'image/png';

  if (!body || encoding !== 'base64') {
    return null;
  }

  return `data:${contentType};base64,${body}`;
}

export function loadChatAvatar(name: string) {
  const normalizedName = name.trim();

  if (!normalizedName) {
    return Promise.resolve(null);
  }

  const cached = cache.get(normalizedName);

  if (cached) {
    return cached;
  }

  const promise = schedule(async () => {
    try {
      return getAvatarDataUrl(
        await qdnRequest({
          action: 'FETCH_QORTAL_RESOURCE',
          identifier: 'qortal_avatar',
          maxBytes: QORTAL_AVATAR_MAX_BYTES,
          name: normalizedName,
          service: 'THUMBNAIL',
        }),
      );
    } catch {
      return null;
    }
  });

  cache.set(normalizedName, promise);

  return promise;
}

export function resetChatAvatarCacheForTest() {
  cache.clear();
  activeFetches = 0;
  queue.length = 0;
}
