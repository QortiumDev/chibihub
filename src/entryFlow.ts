import type { QdnSelectedAccount } from './types';

export type EnterIntent = 'enter-dashboard' | 'unlock-account' | 'wait' | 'blocked';

export function getEnterIntent({
  account,
  canRequestUnlock,
  isAccountLoading,
  isUnlocking,
}: {
  account: QdnSelectedAccount | null;
  canRequestUnlock: boolean;
  isAccountLoading: boolean;
  isUnlocking: boolean;
}): EnterIntent {
  if (isAccountLoading || isUnlocking) {
    return 'wait';
  }

  if (!account) {
    return 'blocked';
  }

  if (account.isUnlocked) {
    return 'enter-dashboard';
  }

  return canRequestUnlock ? 'unlock-account' : 'blocked';
}

export function shouldEnterDashboardAfterUnlock(account: QdnSelectedAccount | null | undefined) {
  return account?.isUnlocked === true;
}
