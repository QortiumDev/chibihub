import { hasAction } from './account';
import { qdnRequest } from './qdnRequest';
import type { BridgeState, QortalNameData, QortalTransaction, SendQortResult } from './types';

const QORTAL_BASE58_ADDRESS_PATTERN = /^Q[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{33}$/;

export function canSendQort(bridgeState: BridgeState | null) {
  return hasAction(bridgeState?.actions, 'SEND_QORT');
}

export function canResolveQortalName(bridgeState: BridgeState | null) {
  return hasAction(bridgeState?.actions, 'GET_QORTAL_NAME_DATA');
}

export function canLookupQortalTransaction(bridgeState: BridgeState | null) {
  return hasAction(bridgeState?.actions, 'GET_QORTAL_TRANSACTION');
}

export function isQortalAddressShaped(value: string) {
  return QORTAL_BASE58_ADDRESS_PATTERN.test(value.trim());
}

export function isSendQortCancelled(
  result: SendQortResult,
): result is Extract<SendQortResult, { canceled: true }> {
  return result.accepted === false && 'canceled' in result && result.canceled === true;
}

export async function resolveQortalNameForPreview(name: string) {
  return qdnRequest<QortalNameData | null>({
    action: 'GET_QORTAL_NAME_DATA',
    name,
  });
}

export async function lookupQortalTransaction(signature: string) {
  return qdnRequest<QortalTransaction | null>({
    action: 'GET_QORTAL_TRANSACTION',
    signature,
  });
}

export function isQortalTransactionConfirmed(transaction: QortalTransaction | null) {
  if (!transaction) {
    return false;
  }

  const height = transaction.blockHeight ?? transaction.height;

  return typeof height === 'number' && Number.isFinite(height) && height > 0;
}

export function sendQort(recipient: string, amount: string) {
  return qdnRequest<SendQortResult>({
    action: 'SEND_QORT',
    amount,
    recipient,
  });
}
