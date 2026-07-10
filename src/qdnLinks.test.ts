import { beforeEach, describe, expect, it, vi } from 'vitest';
import { qdnRequest } from './qdnRequest';
import { canOpenQdnLinks, isOpenableQdnLink, openQdnLink, splitTextByQdnLinks } from './qdnLinks';
import type { BridgeState } from './types';

vi.mock('./qdnRequest', () => ({
  qdnRequest: vi.fn(),
}));

const qdnRequestMock = vi.mocked(qdnRequest);

describe('qdn:// link detection', () => {
  it('returns one text segment when there are no links', () => {
    expect(splitTextByQdnLinks('hello Qortium')).toEqual([{ kind: 'text', value: 'hello Qortium' }]);
  });

  it('splits text around qdn:// links', () => {
    expect(splitTextByQdnLinks('check qdn://APP/ChibiHub/ChibiHub out')).toEqual([
      { kind: 'text', value: 'check ' },
      { kind: 'link', value: 'qdn://APP/ChibiHub/ChibiHub' },
      { kind: 'text', value: ' out' },
    ]);
  });

  it('finds multiple links across lines', () => {
    const segments = splitTextByQdnLinks('one qdn://APP/One\ntwo qdn://WEBSITE/Two/home');

    expect(segments.filter((segment) => segment.kind === 'link').map((segment) => segment.value)).toEqual([
      'qdn://APP/One',
      'qdn://WEBSITE/Two/home',
    ]);
  });

  it('does not swallow sentence punctuation after a link', () => {
    expect(splitTextByQdnLinks('try qdn://APP/ChibiHub, please!')).toEqual([
      { kind: 'text', value: 'try ' },
      { kind: 'link', value: 'qdn://APP/ChibiHub' },
      { kind: 'text', value: ', please!' },
    ]);
  });

  it('keeps balanced brackets but drops unbalanced closers', () => {
    expect(splitTextByQdnLinks('(see qdn://APP/ChibiHub)')).toEqual([
      { kind: 'text', value: '(see ' },
      { kind: 'link', value: 'qdn://APP/ChibiHub' },
      { kind: 'text', value: ')' },
    ]);

    expect(splitTextByQdnLinks('qdn://APP/Name/path(1)')).toEqual([
      { kind: 'link', value: 'qdn://APP/Name/path(1)' },
    ]);
  });

  it('ignores bare qdn:// prefixes with no target', () => {
    expect(splitTextByQdnLinks('a qdn:// b')).toEqual([{ kind: 'text', value: 'a qdn:// b' }]);
    expect(isOpenableQdnLink('qdn://')).toBe(false);
    expect(isOpenableQdnLink('qortal://APP/Name')).toBe(false);
    expect(isOpenableQdnLink('qdn://APP/ChibiHub')).toBe(true);
  });
});

describe('opening qdn:// links through Home', () => {
  beforeEach(() => {
    qdnRequestMock.mockReset();
  });

  it('requires OPEN_NEW_TAB in Home actions', () => {
    const bridgeState: BridgeState = {
      actions: ['GET_QORTAL_CHAT_MESSAGES', 'open_new_tab'],
      isHomeBridge: true,
      ui: 'QORTIUM_HOME_ELECTRON',
    };

    expect(canOpenQdnLinks(bridgeState)).toBe(true);
    expect(canOpenQdnLinks({ ...bridgeState, actions: ['GET_QORTAL_CHAT_MESSAGES'] })).toBe(false);
    expect(canOpenQdnLinks(null)).toBe(false);
  });

  it('opens a qdn:// link with OPEN_NEW_TAB', async () => {
    qdnRequestMock.mockResolvedValue(true);

    await openQdnLink(' qdn://APP/ChibiHub/ChibiHub ');

    expect(qdnRequestMock).toHaveBeenCalledWith({
      action: 'OPEN_NEW_TAB',
      address: 'qdn://APP/ChibiHub/ChibiHub',
    });
  });

  it('rejects non-qdn addresses without calling Home', async () => {
    await expect(openQdnLink('https://example.com')).rejects.toThrow('Only qdn:// links can be opened.');
    await expect(openQdnLink('qortal://APP/Name')).rejects.toThrow('Only qdn:// links can be opened.');
    expect(qdnRequestMock).not.toHaveBeenCalled();
  });
});
