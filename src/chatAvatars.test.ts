import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  expireFailedChatAvatarCache,
  FAILED_CHAT_AVATAR_CACHE_TTL_MS,
  loadChatAvatar,
  resetChatAvatarCacheForTest,
} from './chatAvatars';
import { qdnRequest } from './qdnRequest';

vi.mock('./qdnRequest', () => ({
  qdnRequest: vi.fn(),
}));

const qdnRequestMock = vi.mocked(qdnRequest);

describe('chat avatar cache', () => {
  beforeEach(() => {
    vi.useRealTimers();
    qdnRequestMock.mockReset();
    resetChatAvatarCacheForTest();
  });

  it('keeps successful avatar requests cached', async () => {
    qdnRequestMock.mockResolvedValue({ body: 'AQID', contentType: 'image/png', encoding: 'base64' });

    await expect(loadChatAvatar('QTM')).resolves.toBe('data:image/png;base64,AQID');
    await expect(loadChatAvatar('QTM')).resolves.toBe('data:image/png;base64,AQID');

    expect(qdnRequestMock).toHaveBeenCalledTimes(1);
  });

  it('retries a missing avatar after the failure TTL', async () => {
    vi.useFakeTimers();
    qdnRequestMock
      .mockRejectedValueOnce(new Error('Not propagated yet'))
      .mockResolvedValueOnce({ body: 'BAUG', contentType: 'image/png', encoding: 'base64' });

    await expect(loadChatAvatar('QTM')).resolves.toBeNull();
    await expect(loadChatAvatar('QTM')).resolves.toBeNull();
    expect(qdnRequestMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(FAILED_CHAT_AVATAR_CACHE_TTL_MS + 1);

    await expect(loadChatAvatar('QTM')).resolves.toBe('data:image/png;base64,BAUG');
    expect(qdnRequestMock).toHaveBeenCalledTimes(2);
  });

  it('lets an explicit chat refresh retry failed avatars immediately', async () => {
    qdnRequestMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ body: 'BwgJ', contentType: 'image/png', encoding: 'base64' });

    await expect(loadChatAvatar('QTM')).resolves.toBeNull();
    expireFailedChatAvatarCache();
    await expect(loadChatAvatar('QTM')).resolves.toBe('data:image/png;base64,BwgJ');

    expect(qdnRequestMock).toHaveBeenCalledTimes(2);
  });
});
