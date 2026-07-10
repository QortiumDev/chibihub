import { describe, expect, it } from 'vitest';
import { getEnterIntent, shouldEnterDashboardAfterUnlock } from './entryFlow';
import type { QdnSelectedAccount } from './types';

const account: QdnSelectedAccount = {
  address: 'Q123',
  avatarUrl: null,
  isUnlocked: false,
  name: 'Tester',
};

describe('entry flow', () => {
  it('waits while account state is still loading or unlocking', () => {
    expect(
      getEnterIntent({
        account,
        canRequestUnlock: true,
        isAccountLoading: true,
        isUnlocking: false,
      }),
    ).toBe('wait');

    expect(
      getEnterIntent({
        account,
        canRequestUnlock: true,
        isAccountLoading: false,
        isUnlocking: true,
      }),
    ).toBe('wait');
  });

  it('routes locked accounts through unlock before entering', () => {
    expect(
      getEnterIntent({
        account,
        canRequestUnlock: true,
        isAccountLoading: false,
        isUnlocking: false,
      }),
    ).toBe('unlock-account');
  });

  it('enters only when the selected account is unlocked', () => {
    expect(
      getEnterIntent({
        account: { ...account, isUnlocked: true },
        canRequestUnlock: true,
        isAccountLoading: false,
        isUnlocking: false,
      }),
    ).toBe('enter-dashboard');
  });

  it('auto-enters after a successful unlock result', () => {
    expect(shouldEnterDashboardAfterUnlock({ ...account, isUnlocked: true })).toBe(true);
    expect(shouldEnterDashboardAfterUnlock(account)).toBe(false);
    expect(shouldEnterDashboardAfterUnlock(null)).toBe(false);
  });

  it('blocks when there is no account or no unlock bridge action', () => {
    expect(
      getEnterIntent({
        account: null,
        canRequestUnlock: true,
        isAccountLoading: false,
        isUnlocking: false,
      }),
    ).toBe('blocked');

    expect(
      getEnterIntent({
        account,
        canRequestUnlock: false,
        isAccountLoading: false,
        isUnlocking: false,
      }),
    ).toBe('blocked');
  });
});
