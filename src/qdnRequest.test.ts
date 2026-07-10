import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { qdnRequest, resetLocalDemoAccountForTest } from './qdnRequest';
import type { QdnSelectedAccount } from './types';

describe('qdnRequest local account fallback', () => {
  beforeEach(() => {
    resetLocalDemoAccountForTest();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports selected account actions in local browser development', async () => {
    const actions = await qdnRequest<string[]>({ action: 'SHOW_ACTIONS' });

    expect(actions).toContain('GET_SELECTED_ACCOUNT');
    expect(actions).toContain('UNLOCK_SELECTED_ACCOUNT');
    expect(actions).not.toContain('SEND_QORT');
  });

  it('provides a demo selected account that can be unlocked', async () => {
    const lockedAccount = await qdnRequest<QdnSelectedAccount>({ action: 'GET_SELECTED_ACCOUNT' });

    expect(lockedAccount.name).toBe('ChibiPilot');
    expect(lockedAccount.isUnlocked).toBe(false);

    const unlockedAccount = await qdnRequest<QdnSelectedAccount>({ action: 'UNLOCK_SELECTED_ACCOUNT' });

    expect(unlockedAccount.address).toBe(lockedAccount.address);
    expect(unlockedAccount.isUnlocked).toBe(true);
  });

  it('fetches Qortal node status from the public Qortal node in browser development', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          height: 2642317,
          isSynchronizing: false,
          numberOfConnections: 121,
          numberOfDataConnections: 247,
          syncPercent: 100,
        }),
        { headers: { 'content-type': 'application/json' }, status: 200 },
      );
    });

    vi.stubGlobal('fetch', fetchMock);

    await expect(qdnRequest({ action: 'GET_QORTAL_NODE_STATUS' })).resolves.toMatchObject({
      height: 2642317,
      syncPercent: 100,
    });
    expect(fetchMock).toHaveBeenCalledWith('https://api.qortal.org/admin/status', { method: 'GET' });
  });

  it('returns null for missing Qortal primary names', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 404 }));

    vi.stubGlobal('fetch', fetchMock);

    await expect(qdnRequest({ action: 'GET_QORTAL_PRIMARY_NAME', address: 'Qabc' })).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith('https://api.qortal.org/names/primary/Qabc', { method: 'GET' });
  });

  it('fetches Qortal name data from the public Qortal node in browser development', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ name: 'QuickMythril', owner: 'QT4zHex8JEULmBhYmKd5UhpiNA46T5wUko' }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      });
    });

    vi.stubGlobal('fetch', fetchMock);

    await expect(qdnRequest({ action: 'GET_QORTAL_NAME_DATA', name: 'QuickMythril' })).resolves.toMatchObject({
      owner: 'QT4zHex8JEULmBhYmKd5UhpiNA46T5wUko',
    });
    expect(fetchMock).toHaveBeenCalledWith('https://api.qortal.org/names/QuickMythril', { method: 'GET' });
  });

  it('returns null for unknown Qortal transaction signatures', async () => {
    const fetchMock = vi.fn(async () => new Response('{"error":311,"message":"transaction unknown"}', { status: 404 }));

    vi.stubGlobal('fetch', fetchMock);

    await expect(qdnRequest({ action: 'GET_QORTAL_TRANSACTION', signature: 'sig' })).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith('https://api.qortal.org/transactions/signature/sig', { method: 'GET' });
  });

  it('fetches active Qortal chats from the public Qortal node in browser development', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ direct: [], groups: [] }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      });
    });

    vi.stubGlobal('fetch', fetchMock);

    await expect(qdnRequest({ action: 'GET_QORTAL_ACTIVE_CHATS', address: 'Qabc' })).resolves.toMatchObject({
      groups: [],
    });
    expect(fetchMock).toHaveBeenCalledWith('https://api.qortal.org/chat/active/Qabc?encoding=BASE64', {
      method: 'GET',
    });
  });

  it('fetches Qortal chat messages with whitelisted query params in browser development', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify([]), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      });
    });

    vi.stubGlobal('fetch', fetchMock);

    await expect(
      qdnRequest({
        action: 'GET_QORTAL_CHAT_MESSAGES',
        before: 123,
        involving: 'ignored',
        limit: 2,
        reverse: true,
        txGroupId: 1091,
      }),
    ).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.qortal.org/chat/messages?encoding=BASE64&txGroupId=1091&before=123&limit=2&reverse=true',
      { method: 'GET' },
    );
  });

  it('fetches a single Qortal chat message by signature in browser development', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ signature: 'sig' }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      });
    });

    vi.stubGlobal('fetch', fetchMock);

    await expect(qdnRequest({ action: 'GET_QORTAL_CHAT_MESSAGE', signature: 'sig' })).resolves.toMatchObject({
      signature: 'sig',
    });
    expect(fetchMock).toHaveBeenCalledWith('https://api.qortal.org/chat/message/sig?encoding=BASE64', {
      method: 'GET',
    });
  });

  it('fetches Qortal resources as base64 from the public Qortal node in browser development', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(new Uint8Array([1, 2, 3]), {
        headers: { 'content-type': 'image/png' },
        status: 200,
      });
    });

    vi.stubGlobal('fetch', fetchMock);

    await expect(
      qdnRequest({
        action: 'FETCH_QORTAL_RESOURCE',
        identifier: 'qortal_avatar',
        name: 'QuickMythril',
        service: 'THUMBNAIL',
      }),
    ).resolves.toMatchObject({
      body: 'AQID',
      contentType: 'image/png',
      encoding: 'base64',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.qortal.org/arbitrary/THUMBNAIL/QuickMythril/qortal_avatar',
    );
  });
});
