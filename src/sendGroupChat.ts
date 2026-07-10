import { hasAction } from './account';
import { qdnRequest } from './qdnRequest';
import type { BridgeState, SendQortalGroupChatResult } from './types';

export type SendQortalGroupChatInput = {
  repliedTo?: string | null;
  text: string;
  txGroupId: number;
};

export function canSendQortalGroupChat(bridgeState: BridgeState | null) {
  return hasAction(bridgeState?.actions, 'SEND_QORTAL_GROUP_CHAT');
}

export function isSendQortalGroupChatCancelled(
  result: SendQortalGroupChatResult,
): result is Extract<SendQortalGroupChatResult, { canceled: true }> {
  return result.accepted === false && 'canceled' in result && result.canceled === true;
}

export function getSendQortalGroupChatRequest(input: SendQortalGroupChatInput) {
  return {
    action: 'SEND_QORTAL_GROUP_CHAT',
    repliedTo: input.repliedTo || undefined,
    text: input.text,
    txGroupId: input.txGroupId,
  };
}

export function sendQortalGroupChat(input: SendQortalGroupChatInput) {
  return qdnRequest<SendQortalGroupChatResult>(getSendQortalGroupChatRequest(input));
}
