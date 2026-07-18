import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadAccountBlockStatus } from './accountBlockStatus';
import type { QdnSelectedAccount } from './types';
import type { QortalNodeContext } from './nodeContext';

const account: QdnSelectedAccount = {
  address: 'Qabc',
  avatarUrl: null,
  isUnlocked: true,
  name: 'Home label',
};
const publicNode: QortalNodeContext = {
  isLocal: false,
  label: 'Public Qortal node',
  origin: 'https://api.qortal.org',
};

function response(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}

describe('loadAccountBlockStatus', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('checks exact addresses and every owned name case-insensitively on the resolved origin', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(['Qabc']))
      .mockResolvedValueOnce(response(['ALICE']))
      .mockResolvedValueOnce(response([{ name: 'Alice' }, { name: 'SecondName' }]));
    vi.stubGlobal('fetch', fetchMock);

    await expect(loadAccountBlockStatus(account, 'PrimaryName', publicNode)).resolves.toEqual({
      addressBlocked: true,
      detail: 'This public qortal node blocks the selected account’s address and name.',
      nameBlocked: true,
      state: 'blocked',
    });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://api.qortal.org/lists/blockedAddresses',
      'https://api.qortal.org/lists/blockedNames',
      'https://api.qortal.org/names/address/Qabc',
    ]);
  });

  it('keeps address matching case-sensitive and checks a local origin the same way', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(['qABC']))
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response([]));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      loadAccountBlockStatus(account, null, {
        isLocal: true,
        label: 'Local Qortal node',
        origin: 'http://127.0.0.1:12391',
      }),
    ).resolves.toMatchObject({ addressBlocked: false, state: 'clear' });
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:12391/lists/blockedAddresses', { method: 'GET' });
  });

  it('never infers clear from a missing node, HTTP failure, or malformed list', async () => {
    await expect(loadAccountBlockStatus(account, 'Alice', null)).resolves.toMatchObject({ state: 'unavailable' });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response([], 404)));
    await expect(loadAccountBlockStatus(account, 'Alice', publicNode)).resolves.toMatchObject({
      state: 'unavailable',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(response({ nope: true })).mockResolvedValue(response([])),
    );
    await expect(loadAccountBlockStatus(account, 'Alice', publicNode)).resolves.toMatchObject({
      state: 'unavailable',
    });
  });
});
