import type { QdnSelectedAccount } from './types';
import type { QortalNodeContext } from './nodeContext';

const BLOCKED_ADDRESSES_PATH = '/lists/blockedAddresses';
const BLOCKED_NAMES_PATH = '/lists/blockedNames';

export type AccountBlockStatus = {
  addressBlocked: boolean;
  detail: string;
  nameBlocked: boolean;
  state: 'blocked' | 'checking' | 'clear' | 'unavailable';
};

export const CHECKING_ACCOUNT_BLOCK_STATUS: AccountBlockStatus = {
  addressBlocked: false,
  detail: 'Checking this node’s standard Qortal block lists…',
  nameBlocked: false,
  state: 'checking',
};

export function getAccountBlockStatusLabel(status: AccountBlockStatus) {
  switch (status.state) {
    case 'blocked':
      return 'Blocked on this node';
    case 'checking':
      return 'Checking';
    case 'clear':
      return 'Clear';
    default:
      return 'Unavailable';
  }
}

export function getAccountBlockMascotMood(status: AccountBlockStatus) {
  return status.state === 'blocked' ? 'dead' as const : 'normal' as const;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function getStringList(value: unknown, label: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`${label} did not return a string list.`);
  }

  return value as string[];
}

function getOwnedNames(value: unknown) {
  if (!Array.isArray(value)) {
    throw new Error('Owned Qortal names did not return a list.');
  }

  return value.flatMap((item) => {
    const name = isRecord(item) && typeof item.name === 'string' ? item.name.trim() : '';

    return name ? [name] : [];
  });
}

async function fetchJson(node: QortalNodeContext, path: string) {
  const response = await fetch(`${node.origin}${path}`, { method: 'GET' });

  if (!response.ok) {
    throw new Error(`${path} failed with HTTP ${response.status}.`);
  }

  return response.json() as Promise<unknown>;
}

function unavailable(detail: string): AccountBlockStatus {
  return { addressBlocked: false, detail, nameBlocked: false, state: 'unavailable' };
}

export async function loadAccountBlockStatus(
  account: QdnSelectedAccount,
  displayedQortalName: string | null,
  node: QortalNodeContext | null,
): Promise<AccountBlockStatus> {
  if (!node) {
    return unavailable('The Qortal node source is unavailable, so its block lists could not be checked.');
  }

  try {
    const [rawAddresses, rawNames, rawOwnedNames] = await Promise.all([
      fetchJson(node, BLOCKED_ADDRESSES_PATH),
      fetchJson(node, BLOCKED_NAMES_PATH),
      fetchJson(node, `/names/address/${encodeURIComponent(account.address)}`),
    ]);
    const blockedAddresses = getStringList(rawAddresses, 'Blocked addresses');
    const blockedNames = getStringList(rawNames, 'Blocked names');
    const candidateNames = new Set(getOwnedNames(rawOwnedNames));

    if (displayedQortalName?.trim()) {
      candidateNames.add(displayedQortalName.trim());
    }

    const addressBlocked = blockedAddresses.includes(account.address);
    const normalizedBlockedNames = new Set(blockedNames.map((name) => name.trim().toLocaleLowerCase()));
    const nameBlocked = [...candidateNames].some((name) => normalizedBlockedNames.has(name.toLocaleLowerCase()));

    if (addressBlocked || nameBlocked) {
      const blockedBy = addressBlocked && nameBlocked ? 'address and name' : addressBlocked ? 'address' : 'name';

      return {
        addressBlocked,
        detail: `This ${node.label.toLocaleLowerCase()} blocks the selected account’s ${blockedBy}.`,
        nameBlocked,
        state: 'blocked',
      };
    }

    const nameCount = candidateNames.size;

    return {
      addressBlocked: false,
      detail: nameCount
        ? `Address and ${nameCount} owned Qortal name${nameCount === 1 ? '' : 's'} are clear in this node’s standard block lists.`
        : 'Address is clear; no owned Qortal names were available to check.',
      nameBlocked: false,
      state: 'clear',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return unavailable(`Could not complete this node’s standard block-list check: ${message}`);
  }
}
