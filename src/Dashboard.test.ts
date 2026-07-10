import { describe, expect, it } from 'vitest';
import { DASHBOARD_REFRESH_INTERVAL_MS, getDashboardRefreshInterval } from './Dashboard';

describe('Dashboard refresh timer', () => {
  it('refreshes every 30 seconds unless a send is in flight', () => {
    expect(getDashboardRefreshInterval(false)).toBe(DASHBOARD_REFRESH_INTERVAL_MS);
    expect(getDashboardRefreshInterval(true)).toBeNull();
  });
});
