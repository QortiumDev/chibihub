import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getQortalNodeContextFromResourceUrl, loadQortalNodeContext } from './nodeContext';
import { qdnRequest } from './qdnRequest';

vi.mock('./qdnRequest', () => ({ qdnRequest: vi.fn() }));
const qdnRequestMock = vi.mocked(qdnRequest);

describe('Qortal node context', () => {
  beforeEach(() => qdnRequestMock.mockReset());

  it('classifies loopback resource URLs as local Qortal nodes', () => {
    expect(
      getQortalNodeContextFromResourceUrl({
        url: 'http://127.0.0.1:12391/arbitrary/THUMBNAIL/Qortal/node_probe',
      }),
    ).toEqual({ isLocal: true, label: 'Local Qortal node', origin: 'http://127.0.0.1:12391' });
  });

  it('classifies remote HTTPS resource URLs as public Qortal nodes', () => {
    expect(
      getQortalNodeContextFromResourceUrl({
        url: 'https://api.qortal.org/arbitrary/THUMBNAIL/Qortal/node_probe',
      }),
    ).toEqual({ isLocal: false, label: 'Public Qortal node', origin: 'https://api.qortal.org' });
  });

  it('rejects missing, malformed, and non-http URLs', () => {
    expect(() => getQortalNodeContextFromResourceUrl({})).toThrow('was not returned');
    expect(() => getQortalNodeContextFromResourceUrl({ url: 'not a URL' })).toThrow();
    expect(() => getQortalNodeContextFromResourceUrl({ url: 'file:///tmp/node' })).toThrow('HTTP or HTTPS');
  });

  it('resolves the same Qortal origin Home uses for Qortal app actions', async () => {
    qdnRequestMock.mockResolvedValue({
      url: 'https://ext-node.qortal.link/arbitrary/THUMBNAIL/Qortal/node_probe',
    });

    await expect(
      loadQortalNodeContext({
        actions: ['GET_QORTAL_RESOURCE_URL'],
        isHomeBridge: true,
        ui: 'QORTIUM_HOME',
      }),
    ).resolves.toMatchObject({ origin: 'https://ext-node.qortal.link' });
    expect(qdnRequestMock).toHaveBeenCalledWith({
      action: 'GET_QORTAL_RESOURCE_URL',
      identifier: 'node_probe',
      name: 'Qortal',
      service: 'THUMBNAIL',
    });
  });
});
