import { beforeEach, describe, expect, it, vi } from 'vitest';
import { qdnRequest } from './qdnRequest';
import {
  canLookupQortalTransaction,
  canResolveQortalName,
  canSendQort,
  isQortalAddressShaped,
  isQortalTransactionConfirmed,
  isSendQortCancelled,
  resolveQortalNameForPreview,
  sendQort,
} from './sendQort';
import type { BridgeState, SendQortResult } from './types';

vi.mock('./qdnRequest', () => ({
  qdnRequest: vi.fn(),
}));

const qdnRequestMock = vi.mocked(qdnRequest);

describe('send QORT bridge helpers', () => {
  beforeEach(() => {
    qdnRequestMock.mockReset();
  });

  it('requires SEND_QORT in Home actions', () => {
    const bridgeState: BridgeState = {
      actions: ['GET_QORT_BALANCE', 'send_qort', 'get_qortal_name_data', 'GET_QORTAL_TRANSACTION'],
      isHomeBridge: true,
      ui: 'QORTIUM_HOME_ELECTRON',
    };

    expect(canSendQort(bridgeState)).toBe(true);
    expect(canResolveQortalName(bridgeState)).toBe(true);
    expect(canLookupQortalTransaction(bridgeState)).toBe(true);
    expect(canSendQort({ ...bridgeState, actions: ['GET_QORT_BALANCE'] })).toBe(false);
    expect(canSendQort(null)).toBe(false);
  });

  it('distinguishes address-shaped recipients from names for preview only', () => {
    expect(isQortalAddressShaped('QT4zHex8JEULmBhYmKd5UhpiNA46T5wUko')).toBe(true);
    expect(isQortalAddressShaped('QuickMythril')).toBe(false);
  });

  it('sends raw name or address input to Home for authoritative resolution', async () => {
    qdnRequestMock.mockResolvedValueOnce({
      accepted: true,
      action: 'SEND_QORT',
      amount: '1',
      fee: '0.01',
      recipient: 'QT4zHex8JEULmBhYmKd5UhpiNA46T5wUko',
      recipientName: 'QuickMythril',
      signature: 'sig',
    });

    await sendQort('QuickMythril', '1');

    expect(qdnRequestMock).toHaveBeenCalledWith({
      action: 'SEND_QORT',
      amount: '1',
      recipient: 'QuickMythril',
    });
  });

  it('previews Qortal name data through the bridge', async () => {
    qdnRequestMock.mockResolvedValueOnce({ name: 'QuickMythril', owner: 'QT4zHex8JEULmBhYmKd5UhpiNA46T5wUko' });

    await expect(resolveQortalNameForPreview('QuickMythril')).resolves.toMatchObject({
      owner: 'QT4zHex8JEULmBhYmKd5UhpiNA46T5wUko',
    });
    expect(qdnRequestMock).toHaveBeenCalledWith({ action: 'GET_QORTAL_NAME_DATA', name: 'QuickMythril' });
  });

  it('detects confirmed transaction responses', () => {
    expect(isQortalTransactionConfirmed(null)).toBe(false);
    expect(isQortalTransactionConfirmed({ signature: 'sig' })).toBe(false);
    expect(isQortalTransactionConfirmed({ blockHeight: 2642500, signature: 'sig' })).toBe(true);
  });

  it('recognizes user-cancelled send results without treating them as errors', () => {
    const canceled: SendQortResult = {
      accepted: false,
      canceled: true,
      reason: 'USER_CANCELLED',
    };
    const rejected: SendQortResult = {
      accepted: false,
      error: 'Nope',
      errorType: 'VALIDATION_FAILED',
    };

    expect(isSendQortCancelled(canceled)).toBe(true);
    expect(isSendQortCancelled(rejected)).toBe(false);
  });
});
