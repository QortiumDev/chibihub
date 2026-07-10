import { qdnRequest } from './qdnRequest';
import type { QdnSelectedAccount } from './types';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function hasAction(actions: string[] | undefined, action: string) {
  return actions?.some((candidate) => candidate.toUpperCase() === action.toUpperCase()) ?? false;
}

export function isSelectedAccountChangedMessage(value: unknown) {
  return (
    isRecord(value) &&
    (value.type === 'qortium:selected-account-changed' || value.action === 'SELECTED_ACCOUNT_CHANGED')
  );
}

export function formatAddress(address: string | null | undefined) {
  const trimmed = address?.trim() ?? '';

  if (!trimmed) {
    return 'No address selected';
  }

  if (trimmed.length <= 18) {
    return trimmed;
  }

  return `${trimmed.slice(0, 8)}...${trimmed.slice(-8)}`;
}

export function getAccountDisplayName(account: QdnSelectedAccount | null) {
  return account?.name?.trim() || 'Selected account';
}

export function getAvatarInitials(account: QdnSelectedAccount | null) {
  const label = getAccountDisplayName(account);
  const words = label.split(/\s+/).filter(Boolean);

  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }

  return label.slice(0, 2).toUpperCase();
}

export function loadSelectedAccount() {
  return qdnRequest<QdnSelectedAccount>({ action: 'GET_SELECTED_ACCOUNT' });
}

export function unlockSelectedAccount() {
  return qdnRequest<QdnSelectedAccount>({ action: 'UNLOCK_SELECTED_ACCOUNT' });
}
