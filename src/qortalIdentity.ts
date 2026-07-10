import { hasAction } from './account';
import { qdnRequest } from './qdnRequest';
import type { BridgeState, QdnSelectedAccount } from './types';

const QORTAL_AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export type QortalIdentity = {
  address: string;
  avatarUrl: string | null;
  errors: string[];
  name: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function getErrorMessage(value: unknown) {
  return value instanceof Error ? value.message : String(value);
}

function getNameFromRecord(value: unknown) {
  const record = asRecord(value);
  const name = typeof record?.name === 'string' ? record.name.trim() : '';

  return name || null;
}

function getFirstNameFromList(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  for (const item of value) {
    const name = getNameFromRecord(item);

    if (name) {
      return name;
    }
  }

  return null;
}

function getAvatarDataUrl(value: unknown) {
  const record = asRecord(value);
  const body = typeof record?.body === 'string' ? record.body.trim() : '';
  const encoding = typeof record?.encoding === 'string' ? record.encoding.toLowerCase() : '';
  const contentType = typeof record?.contentType === 'string' && record.contentType ? record.contentType : 'image/png';

  if (!body || encoding !== 'base64') {
    return null;
  }

  return `data:${contentType};base64,${body}`;
}

async function loadPrimaryName(account: QdnSelectedAccount, actions: string[], errors: string[]) {
  if (!hasAction(actions, 'GET_QORTAL_PRIMARY_NAME')) {
    errors.push('Home build too old: missing GET_QORTAL_PRIMARY_NAME');
    return null;
  }

  try {
    return getNameFromRecord(
      await qdnRequest({
        action: 'GET_QORTAL_PRIMARY_NAME',
        address: account.address,
      }),
    );
  } catch (error) {
    errors.push(`Qortal primary name: ${getErrorMessage(error)}`);
    return null;
  }
}

async function loadFirstRegisteredName(account: QdnSelectedAccount, actions: string[], errors: string[]) {
  if (!hasAction(actions, 'GET_QORTAL_ACCOUNT_NAMES')) {
    errors.push('Home build too old: missing GET_QORTAL_ACCOUNT_NAMES');
    return null;
  }

  try {
    return getFirstNameFromList(
      await qdnRequest({
        action: 'GET_QORTAL_ACCOUNT_NAMES',
        address: account.address,
      }),
    );
  } catch (error) {
    errors.push(`Qortal account names: ${getErrorMessage(error)}`);
    return null;
  }
}

async function loadQortalAvatar(name: string, actions: string[]) {
  if (!hasAction(actions, 'FETCH_QORTAL_RESOURCE')) {
    return null;
  }

  try {
    return getAvatarDataUrl(
      await qdnRequest({
        action: 'FETCH_QORTAL_RESOURCE',
        identifier: 'qortal_avatar',
        maxBytes: QORTAL_AVATAR_MAX_BYTES,
        name,
        service: 'THUMBNAIL',
      }),
    );
  } catch {
    return null;
  }
}

export function getQortalIdentityDisplayName(identity: QortalIdentity | null) {
  return identity?.name?.trim() || 'Selected account';
}

export function getQortalIdentityInitials(identity: QortalIdentity | null) {
  const label = getQortalIdentityDisplayName(identity);
  const parts = label.split(/\s+/).filter(Boolean);

  if (label === 'Selected account') {
    return 'SA';
  }

  if (parts.length === 1) {
    return parts[0]?.slice(0, 2).toUpperCase() || 'Q';
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export async function loadQortalIdentity(
  account: QdnSelectedAccount,
  bridgeState: BridgeState | null,
): Promise<QortalIdentity> {
  const actions = bridgeState?.actions ?? [];
  const errors: string[] = [];
  const primaryName = await loadPrimaryName(account, actions, errors);
  const name = primaryName || (await loadFirstRegisteredName(account, actions, errors));
  const avatarUrl = name ? await loadQortalAvatar(name, actions) : null;

  return {
    address: account.address,
    avatarUrl,
    errors,
    name,
  };
}
