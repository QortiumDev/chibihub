import { hasAction } from './account';
import { qdnRequest } from './qdnRequest';
import type { BridgeState, NodeStatus, QdnSelectedAccount } from './types';

export type QortalDashboardSnapshot = {
  balanceLabel: string;
  errors: string[];
  heightLabel: string;
  loadedAt: number;
  nodeModeLabel: string;
  nodeStatusLabel: string;
  peersLabel: string;
  qdnPeersLabel: string;
  statusTone: 'ready' | 'syncing' | 'offline' | 'unknown';
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function formatInteger(value: unknown) {
  const numericValue = asNumber(value);

  return numericValue == null ? '—' : Math.round(numericValue).toLocaleString();
}

export function formatQortBalance(value: unknown) {
  const numericValue = asNumber(value);

  if (numericValue == null) {
    return '—';
  }

  return `${numericValue.toLocaleString(undefined, {
    maximumFractionDigits: 8,
    minimumFractionDigits: numericValue === 0 ? 0 : 2,
  })} QORT`;
}

export function summarizeNodeStatus(status: NodeStatus | null): Pick<
  QortalDashboardSnapshot,
  'heightLabel' | 'nodeStatusLabel' | 'peersLabel' | 'qdnPeersLabel' | 'statusTone'
> {
  if (!status) {
    return {
      heightLabel: '—',
      nodeStatusLabel: 'Status unavailable',
      peersLabel: '—',
      qdnPeersLabel: '—',
      statusTone: 'unknown',
    };
  }

  const syncPercent = asNumber(status.syncPercent);
  const isSynced = status.isSynchronizing === false && syncPercent === 100;
  const isSyncing = status.isSynchronizing === true || (syncPercent != null && syncPercent < 100);

  return {
    heightLabel: formatInteger(status.height),
    nodeStatusLabel: isSynced
      ? '100% synced'
      : isSyncing && syncPercent != null
        ? `${Math.max(0, Math.min(100, Math.round(syncPercent)))}% syncing`
        : status.syncPhase
          ? String(status.syncPhase)
          : 'Status unavailable',
    peersLabel: formatInteger(status.numberOfConnections),
    qdnPeersLabel: formatInteger(status.numberOfDataConnections),
    statusTone: isSynced ? 'ready' : isSyncing ? 'syncing' : 'unknown',
  };
}

async function loadQortBalance(account: QdnSelectedAccount, actions: string[]) {
  if (!hasAction(actions, 'GET_QORT_BALANCE')) {
    throw new Error('Home build too old: missing GET_QORT_BALANCE');
  }

  return qdnRequest<unknown>({
    action: 'GET_QORT_BALANCE',
    address: account.address,
  });
}

async function loadQortalNodeStatus(actions: string[]) {
  if (!hasAction(actions, 'GET_QORTAL_NODE_STATUS')) {
    throw new Error('Home build too old: missing GET_QORTAL_NODE_STATUS');
  }

  return qdnRequest<NodeStatus>({ action: 'GET_QORTAL_NODE_STATUS' });
}

function getErrorMessage(value: unknown) {
  return value instanceof Error ? value.message : String(value);
}

export async function loadQortalDashboardSnapshot(
  account: QdnSelectedAccount,
  bridgeState: BridgeState | null,
): Promise<QortalDashboardSnapshot> {
  const actions = bridgeState?.actions ?? [];
  const errors: string[] = [];
  const [balanceResult, statusResult] = await Promise.allSettled([
    loadQortBalance(account, actions),
    loadQortalNodeStatus(actions),
  ]);

  if (balanceResult.status === 'rejected') {
    errors.push(`Balance: ${getErrorMessage(balanceResult.reason)}`);
  }

  if (statusResult.status === 'rejected') {
    errors.push(`Node status: ${getErrorMessage(statusResult.reason)}`);
  }

  const status = statusResult.status === 'fulfilled' ? asRecord(statusResult.value) : null;
  const statusSummary = summarizeNodeStatus(status);

  return {
    ...statusSummary,
    balanceLabel: balanceResult.status === 'fulfilled' ? formatQortBalance(balanceResult.value) : '—',
    errors,
    loadedAt: Date.now(),
    nodeModeLabel: 'Qortal node',
  };
}
