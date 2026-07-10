import { describe, expect, it } from 'vitest';
import {
  formatAddress,
  getAccountDisplayName,
  getAvatarInitials,
  hasAction,
  isSelectedAccountChangedMessage,
} from './account';
import type { QdnSelectedAccount } from './types';

const account: QdnSelectedAccount = {
  address: 'Q1234567890ABCDEFGH1234567890ABCDEFGH',
  avatarUrl: null,
  isUnlocked: false,
  name: 'Green Mythril',
};

describe('account helpers', () => {
  it('shortens long Qortal addresses', () => {
    expect(formatAddress(account.address)).toBe('Q1234567...ABCDEFGH');
  });

  it('keeps short addresses readable', () => {
    expect(formatAddress('QShort')).toBe('QShort');
  });

  it('falls back when an account has no name', () => {
    expect(getAccountDisplayName({ ...account, name: null })).toBe('Selected account');
    expect(getAvatarInitials({ ...account, name: null })).toBe('SA');
  });

  it('builds initials from the selected account name', () => {
    expect(getAvatarInitials(account)).toBe('GM');
  });

  it('detects selected account change messages from Home', () => {
    expect(isSelectedAccountChangedMessage({ type: 'qortium:selected-account-changed' })).toBe(true);
    expect(isSelectedAccountChangedMessage({ action: 'SELECTED_ACCOUNT_CHANGED' })).toBe(true);
    expect(isSelectedAccountChangedMessage({ action: 'THEME_CHANGED' })).toBe(false);
    expect(isSelectedAccountChangedMessage(null)).toBe(false);
  });

  it('matches bridge actions case-insensitively', () => {
    expect(hasAction(['show_actions', 'unlock_selected_account'], 'UNLOCK_SELECTED_ACCOUNT')).toBe(true);
    expect(hasAction(['SHOW_ACTIONS'], 'UNLOCK_SELECTED_ACCOUNT')).toBe(false);
  });
});
