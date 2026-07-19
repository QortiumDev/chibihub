import { describe, expect, it } from 'vitest';
import { getChibiHubRouteUrl, readChibiHubRoute, resolveChatGroupId } from './appRoute';

describe('ChibiHub route codec', () => {
  it('reads dashboard, chat, and group routes', () => {
    expect(readChibiHubRoute('https://example.test/render/APP/ChibiHub/ChibiHub')).toEqual({
      view: 'dashboard',
    });
    expect(readChibiHubRoute('https://example.test/?view=chat')).toEqual({
      groupId: null,
      view: 'chat',
    });
    expect(readChibiHubRoute('https://example.test/?view=chat&group=42')).toEqual({
      groupId: 42,
      view: 'chat',
    });
    expect(readChibiHubRoute('https://example.test/?group=7')).toEqual({
      groupId: 7,
      view: 'chat',
    });
  });

  it('rejects malformed group IDs and canonicalizes unknown app routes to dashboard', () => {
    expect(readChibiHubRoute('https://example.test/?view=other&group=-2')).toEqual({
      view: 'dashboard',
    });
    expect(readChibiHubRoute('https://example.test/?view=chat&group=3.5')).toEqual({
      groupId: null,
      view: 'chat',
    });
  });

  it('preserves host display, bridge, fragment, and unknown parameters', () => {
    const url = getChibiHubRouteUrl(
      'https://example.test/render/APP/ChibiHub/ChibiHub?theme=dark&qdnHomeBridge=token&lang=fr&textSize=large&accent=violet&uiStyle=fun&future=value&view=old&group=bad#message',
      { groupId: 81, view: 'chat' },
    );

    expect(`${url.pathname}${url.search}${url.hash}`).toBe(
      '/render/APP/ChibiHub/ChibiHub?theme=dark&qdnHomeBridge=token&lang=fr&textSize=large&accent=violet&uiStyle=fun&future=value&view=chat&group=81#message',
    );
  });

  it('removes only app-owned parameters for the dashboard', () => {
    const url = getChibiHubRouteUrl(
      'https://example.test/?view=chat&group=9&qdnHomeBridge=token&custom=kept',
      { view: 'dashboard' },
    );

    expect(url.search).toBe('?qdnHomeBridge=token&custom=kept');
  });

  it('emits no account, draft, reply, status, dialog, filter, or error state', () => {
    const url = getChibiHubRouteUrl('https://example.test/', { groupId: 9, view: 'chat' });

    expect(url.search).toBe('?view=chat&group=9');
  });
});

describe('chat group restoration', () => {
  it('holds a valid requested group once the available groups arrive', () => {
    expect(resolveChatGroupId(12, [3, 12, 40])).toBe(12);
  });

  it('falls back deterministically only after group data is available', () => {
    expect(resolveChatGroupId(12, [])).toBeNull();
    expect(resolveChatGroupId(12, [3, 40])).toBe(3);
    expect(resolveChatGroupId(null, [3, 40])).toBe(3);
  });
});
