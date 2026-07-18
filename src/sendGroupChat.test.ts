import { beforeEach, describe, expect, it, vi } from 'vitest';
import { qdnRequest } from './qdnRequest';
import {
  canSendQortalGroupChat,
  canSendToQortalGroup,
  getSendQortalGroupChatRequest,
  isSendQortalGroupChatCancelled,
  sendQortalGroupChat,
} from './sendGroupChat';
import type { BridgeState, SendQortalGroupChatResult } from './types';

vi.mock('./qdnRequest', () => ({
  qdnRequest: vi.fn(),
}));

const qdnRequestMock = vi.mocked(qdnRequest);

describe('Qortal group chat send helpers', () => {
  beforeEach(() => {
    qdnRequestMock.mockReset();
  });

  it('requires SEND_QORTAL_GROUP_CHAT in Home actions', () => {
    const bridgeState: BridgeState = {
      actions: ['GET_QORTAL_CHAT_MESSAGES', 'send_qortal_group_chat'],
      isHomeBridge: true,
      ui: 'QORTIUM_HOME_ELECTRON',
    };

    expect(canSendQortalGroupChat(bridgeState)).toBe(true);
    expect(canSendQortalGroupChat({ ...bridgeState, actions: ['GET_QORTAL_CHAT_MESSAGES'] })).toBe(false);
    expect(canSendQortalGroupChat(null)).toBe(false);
  });

  it('only enables sending when Home supports it and the group is confirmed public', () => {
    const bridgeState: BridgeState = {
      actions: ['SEND_QORTAL_GROUP_CHAT'],
      isHomeBridge: true,
      ui: 'QORTIUM_HOME_ELECTRON',
    };

    expect(canSendToQortalGroup(bridgeState, { isOpen: true })).toBe(true);
    expect(canSendToQortalGroup(bridgeState, { isOpen: false })).toBe(false);
    expect(canSendToQortalGroup(bridgeState, { isOpen: null })).toBe(false);
    expect(canSendToQortalGroup({ ...bridgeState, actions: [] }, { isOpen: true })).toBe(false);
    expect(canSendToQortalGroup(bridgeState, null)).toBe(false);
  });

  it('builds the Home request with reply signature when present', () => {
    expect(
      getSendQortalGroupChatRequest({
        repliedTo: 'reply-sig',
        text: 'Hello Qortal',
        txGroupId: 1091,
      }),
    ).toEqual({
      action: 'SEND_QORTAL_GROUP_CHAT',
      repliedTo: 'reply-sig',
      text: 'Hello Qortal',
      txGroupId: 1091,
    });
  });

  it('omits empty repliedTo values from the request', () => {
    expect(getSendQortalGroupChatRequest({ repliedTo: '', text: 'Hello', txGroupId: 1091 })).toEqual({
      action: 'SEND_QORTAL_GROUP_CHAT',
      repliedTo: undefined,
      text: 'Hello',
      txGroupId: 1091,
    });
  });

  it('sends the request through qdnRequest', async () => {
    qdnRequestMock.mockResolvedValueOnce({
      accepted: true,
      action: 'SEND_QORTAL_GROUP_CHAT',
      groupId: 1091,
      signature: 'sig',
    });

    await sendQortalGroupChat({ repliedTo: 'reply-sig', text: 'Hello Qortal', txGroupId: 1091 });

    expect(qdnRequestMock).toHaveBeenCalledWith({
      action: 'SEND_QORTAL_GROUP_CHAT',
      repliedTo: 'reply-sig',
      text: 'Hello Qortal',
      txGroupId: 1091,
    });
  });

  it('recognizes user-cancelled chat sends', () => {
    const canceled: SendQortalGroupChatResult = {
      accepted: false,
      canceled: true,
      reason: 'USER_CANCELLED',
    };
    const rejected: SendQortalGroupChatResult = {
      accepted: false,
      error: 'Nope',
      errorType: 'VALIDATION_FAILED',
    };

    expect(isSendQortalGroupChatCancelled(canceled)).toBe(true);
    expect(isSendQortalGroupChatCancelled(rejected)).toBe(false);
  });
});
