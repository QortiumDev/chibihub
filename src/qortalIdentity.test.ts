import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadQortalIdentity } from './qortalIdentity';
import { qdnRequest } from './qdnRequest';
import type { BridgeState, QdnSelectedAccount } from './types';

vi.mock('./qdnRequest', () => ({
  qdnRequest: vi.fn(),
}));

const qdnRequestMock = vi.mocked(qdnRequest);

const account: QdnSelectedAccount = {
  address: 'Qabc',
  avatarUrl: 'qortium://avatar',
  isUnlocked: true,
  name: 'Qortium Name',
};

const bridgeState: BridgeState = {
  actions: ['GET_QORTAL_PRIMARY_NAME', 'GET_QORTAL_ACCOUNT_NAMES', 'FETCH_QORTAL_RESOURCE'],
  isHomeBridge: true,
  ui: 'QORTIUM_HOME',
};

describe('Qortal identity', () => {
  beforeEach(() => {
    qdnRequestMock.mockReset();
  });

  it('uses the Qortal primary name and Qortal avatar resource', async () => {
    qdnRequestMock
      .mockResolvedValueOnce({ name: 'QuickMythril', owner: 'Qabc' })
      .mockResolvedValueOnce({
        body: 'AQID',
        contentType: 'image/png',
        encoding: 'base64',
      });

    const identity = await loadQortalIdentity(account, bridgeState);

    expect(identity.name).toBe('QuickMythril');
    expect(identity.avatarUrl).toBe('data:image/png;base64,AQID');
    expect(identity.errors).toEqual([]);
    expect(qdnRequestMock.mock.calls).toEqual([
      [{ action: 'GET_QORTAL_PRIMARY_NAME', address: 'Qabc' }],
      [
        {
          action: 'FETCH_QORTAL_RESOURCE',
          identifier: 'qortal_avatar',
          maxBytes: 2097152,
          name: 'QuickMythril',
          service: 'THUMBNAIL',
        },
      ],
    ]);
  });

  it('falls back to the first Qortal registered name when no primary name exists', async () => {
    qdnRequestMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([{ name: 'FirstQortalName' }, { name: 'SecondQortalName' }])
      .mockRejectedValueOnce(new Error('No avatar'));

    const identity = await loadQortalIdentity(account, bridgeState);

    expect(identity.name).toBe('FirstQortalName');
    expect(identity.avatarUrl).toBeNull();
    expect(identity.errors).toEqual([]);
    expect(qdnRequestMock.mock.calls[1]).toEqual([{ action: 'GET_QORTAL_ACCOUNT_NAMES', address: 'Qabc' }]);
  });

  it('does not use the Qortium selected account name or avatar as fallbacks', async () => {
    const identity = await loadQortalIdentity(account, {
      actions: [],
      isHomeBridge: true,
      ui: 'QORTIUM_HOME',
    });

    expect(identity.name).toBeNull();
    expect(identity.avatarUrl).toBeNull();
    expect(identity.errors).toEqual([
      'Home build too old: missing GET_QORTAL_PRIMARY_NAME',
      'Home build too old: missing GET_QORTAL_ACCOUNT_NAMES',
    ]);
    expect(qdnRequestMock).not.toHaveBeenCalled();
  });
});
