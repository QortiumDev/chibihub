import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatQortBalance, loadQortalDashboardSnapshot, summarizeNodeStatus } from './dashboardData';
import { qdnRequest } from './qdnRequest';
import type { BridgeState, QdnSelectedAccount } from './types';

vi.mock('./qdnRequest', () => ({
  qdnRequest: vi.fn(),
}));

const qdnRequestMock = vi.mocked(qdnRequest);

const account: QdnSelectedAccount = {
  address: 'Qabc',
  avatarUrl: null,
  isUnlocked: true,
  name: 'Qortal Tester',
};

const bridgeState: BridgeState = {
  actions: ['GET_QORT_BALANCE', 'GET_QORTAL_NODE_STATUS'],
  isHomeBridge: true,
  ui: 'QORTIUM_HOME',
};

describe('Qortal dashboard data', () => {
  beforeEach(() => {
    qdnRequestMock.mockReset();
  });

  it('formats QORT balances without adding fake precision', () => {
    expect(formatQortBalance('28.73')).toBe('28.73 QORT');
    expect(formatQortBalance(0)).toBe('0 QORT');
    expect(formatQortBalance('not a number')).toBe('—');
  });

  it('summarizes synced and syncing node status', () => {
    expect(
      summarizeNodeStatus({
        height: 46124,
        isSynchronizing: false,
        numberOfConnections: 5,
        numberOfDataConnections: 2,
        syncPercent: 100,
      }),
    ).toEqual({
      heightLabel: '46,124',
      nodeStatusLabel: '100% synced',
      peersLabel: '5',
      qdnPeersLabel: '2',
      statusTone: 'ready',
    });

    expect(
      summarizeNodeStatus({
        isSynchronizing: true,
        syncPercent: 87,
      }).nodeStatusLabel,
    ).toBe('87% syncing');
  });

  it('loads Qortal dashboard reads through public-node bridge actions', async () => {
    qdnRequestMock
      .mockResolvedValueOnce('12.5')
      .mockResolvedValueOnce({
        height: 50,
        isSynchronizing: false,
        numberOfConnections: 3,
        numberOfDataConnections: 1,
        syncPercent: 100,
      });

    const snapshot = await loadQortalDashboardSnapshot(account, bridgeState);

    expect(snapshot.balanceLabel).toBe('12.50 QORT');
    expect(snapshot.nodeStatusLabel).toBe('100% synced');
    expect(qdnRequestMock).toHaveBeenCalledTimes(2);
    expect(qdnRequestMock.mock.calls).toEqual([
      [{ action: 'GET_QORT_BALANCE', address: 'Qabc' }],
      [{ action: 'GET_QORTAL_NODE_STATUS' }],
    ]);
  });

  it('shows a clear old-Home error when GET_QORT_BALANCE is missing', async () => {
    qdnRequestMock.mockResolvedValueOnce({
      height: 51,
      isSynchronizing: false,
      syncPercent: 100,
    });

    const snapshot = await loadQortalDashboardSnapshot(account, {
      actions: ['GET_BALANCE', 'GET_QORTAL_NODE_STATUS'],
      isHomeBridge: true,
      ui: 'QORTIUM_HOME',
    });

    expect(snapshot.balanceLabel).toBe('—');
    expect(snapshot.heightLabel).toBe('51');
    expect(snapshot.errors).toContain('Balance: Home build too old: missing GET_QORT_BALANCE');
    expect(qdnRequestMock.mock.calls).toEqual([[{ action: 'GET_QORTAL_NODE_STATUS' }]]);
  });

  it('shows a clear old-Home error when GET_QORTAL_NODE_STATUS is missing', async () => {
    qdnRequestMock.mockResolvedValueOnce('7.1');

    const snapshot = await loadQortalDashboardSnapshot(account, {
      actions: ['GET_QORT_BALANCE', 'GET_NODE_STATUS', 'FETCH_NODE_API'],
      isHomeBridge: true,
      ui: 'QORTIUM_HOME',
    });

    expect(snapshot.balanceLabel).toBe('7.10 QORT');
    expect(snapshot.heightLabel).toBe('—');
    expect(snapshot.nodeStatusLabel).toBe('Status unavailable');
    expect(snapshot.errors).toContain('Node status: Home build too old: missing GET_QORTAL_NODE_STATUS');
    expect(qdnRequestMock.mock.calls).toEqual([[{ action: 'GET_QORT_BALANCE', address: 'Qabc' }]]);
  });

  it('does not fall back to wrong-chain balance or status actions', async () => {
    const snapshot = await loadQortalDashboardSnapshot(account, {
      actions: ['GET_BALANCE', 'GET_NODE_STATUS', 'FETCH_NODE_API'],
      isHomeBridge: true,
      ui: 'QORTIUM_HOME',
    });

    expect(snapshot.balanceLabel).toBe('—');
    expect(snapshot.heightLabel).toBe('—');
    expect(snapshot.errors).toEqual([
      'Balance: Home build too old: missing GET_QORT_BALANCE',
      'Node status: Home build too old: missing GET_QORTAL_NODE_STATUS',
    ]);
    expect(qdnRequestMock).not.toHaveBeenCalled();
  });
});
