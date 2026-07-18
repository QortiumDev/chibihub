import type { BridgeState, NodeApiFetchResult, QdnSelectedAccount } from './types';

const DEFAULT_NODE_API_URL = 'http://127.0.0.1:24891';
const QORTAL_PUBLIC_NODE_API_URL = 'https://api.qortal.org';

export const LOCAL_READ_ACTIONS = [
  'FETCH_NODE_API',
  'FETCH_QDN_RESOURCE',
  'FETCH_QORTAL_RESOURCE',
  'GET_QORT_BALANCE',
  'GET_QORTAL_ACCOUNT_GROUPS',
  'GET_QORTAL_ACCOUNT_NAMES',
  'GET_QORTAL_ACTIVE_CHATS',
  'GET_QORTAL_CHAT_MESSAGE',
  'GET_QORTAL_CHAT_MESSAGES',
  'GET_QORTAL_NAME_DATA',
  'GET_QORTAL_NODE_STATUS',
  'GET_QORTAL_PRIMARY_NAME',
  'GET_QORTAL_TRANSACTION',
  'GET_QORTAL_RESOURCE_URL',
  'GET_NODE_STATUS',
  'IS_USING_PUBLIC_NODE',
  'LIST_QDN_RESOURCES',
  'SEARCH_QDN_RESOURCES',
  'SHOW_ACTIONS',
  'WHICH_UI',
] as const;

export const LOCAL_ACCOUNT_ACTIONS = ['GET_SELECTED_ACCOUNT', 'UNLOCK_SELECTED_ACCOUNT'] as const;

export const LOCAL_AVAILABLE_ACTIONS = [...LOCAL_READ_ACTIONS, ...LOCAL_ACCOUNT_ACTIONS] as const;

const LOCAL_DEMO_ACCOUNT: QdnSelectedAccount = {
  address: 'QChibiHubDemoAddress111111111111111',
  avatarUrl: null,
  isUnlocked: false,
  name: 'ChibiPilot',
};

let localDemoAccountUnlocked = false;

export type QdnRequest = {
  action: string;
  maxBytes?: number;
  method?: string;
  path?: string;
  [key: string]: unknown;
};

export function getNodeApiUrl() {
  return (import.meta.env.VITE_QORTIUM_NODE_API_URL || DEFAULT_NODE_API_URL).replace(/\/+$/, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parseResponseData(body: string, contentType: string) {
  if (!body) {
    return null;
  }

  if (contentType.toLowerCase().includes('json') || /^[\s\n\r]*[\[{]/.test(body)) {
    try {
      return JSON.parse(body) as unknown;
    } catch {
      return body;
    }
  }

  return body;
}

function sanitizeNodePath(path: unknown) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) {
    throw new Error('Node API paths must start with /.');
  }

  if (/[\x00-\x1F]/.test(path)) {
    throw new Error('Node API path contains invalid control characters.');
  }

  const url = new URL(path, DEFAULT_NODE_API_URL);

  return `${url.pathname}${url.search}`;
}

function sanitizeReadMethod(method: unknown) {
  const normalizedMethod = typeof method === 'string' && method.trim() ? method.trim().toUpperCase() : 'GET';

  if (normalizedMethod !== 'GET' && normalizedMethod !== 'HEAD') {
    throw new Error('Only GET and HEAD node API requests are supported in browser development.');
  }

  return normalizedMethod;
}

function appendQueryValue(queryParams: URLSearchParams, key: string, value: unknown) {
  if (Array.isArray(value)) {
    for (const item of value) {
      appendQueryValue(queryParams, key, item);
    }

    return;
  }

  if (typeof value === 'boolean' || typeof value === 'number') {
    queryParams.append(key, String(value));
    return;
  }

  if (typeof value === 'string' && value.trim()) {
    queryParams.append(key, value.trim());
  }
}

function getString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function getRequiredAddress(request: QdnRequest) {
  const address = getString(request.address);

  if (!address) {
    throw new Error('Address is required.');
  }

  return address;
}

function buildQdnResourcesPath(request: QdnRequest, pathBase: string) {
  const queryParams = new URLSearchParams();
  const queryFields: Record<string, string> = {
    default: 'default',
    description: 'description',
    exactMatchNames: 'exactmatchnames',
    excludeBlocked: 'excludeblocked',
    followedOnly: 'followedonly',
    identifier: 'identifier',
    includeMetadata: 'includemetadata',
    includeStatus: 'includestatus',
    keywords: 'keywords',
    limit: 'limit',
    mode: 'mode',
    name: 'name',
    nameListFilter: 'namefilter',
    names: 'name',
    offset: 'offset',
    prefix: 'prefix',
    query: 'query',
    reverse: 'reverse',
    service: 'service',
    title: 'title',
  };

  for (const [requestKey, queryKey] of Object.entries(queryFields)) {
    appendQueryValue(queryParams, queryKey, request[requestKey]);
  }

  const queryString = queryParams.toString();

  return `${pathBase}${queryString ? `?${queryString}` : ''}`;
}

function buildFetchQdnResourcePath(request: QdnRequest) {
  const service = getString(request.service).toUpperCase();
  const name = getString(request.name);
  const identifier = getString(request.identifier);
  const resourcePath = getString(request.path) || getString(request.filepath);
  const queryParams = new URLSearchParams();

  if (!service || !name) {
    throw new Error('QDN resource service and name are required.');
  }

  if (resourcePath) {
    queryParams.set('filepath', resourcePath);
  }

  for (const key of ['encoding', 'rebuild', 'async']) {
    const value = request[key];

    if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
      queryParams.set(key, String(value));
    }
  }

  const queryString = queryParams.toString();

  return `/arbitrary/${service}/${encodeURIComponent(name)}${identifier ? `/${encodeURIComponent(identifier)}` : ''}${
    queryString ? `?${queryString}` : ''
  }`;
}

function buildFetchQortalResourcePath(request: QdnRequest) {
  const service = getString(request.service).toUpperCase();
  const name = getString(request.name);
  const identifier = getString(request.identifier);
  const resourcePath = getString(request.path) || getString(request.filepath);
  const queryParams = new URLSearchParams();

  if (!service || !name) {
    throw new Error('Qortal resource service and name are required.');
  }

  if (!/^[A-Z0-9_]+$/.test(service)) {
    throw new Error('Qortal resource service is invalid.');
  }

  if (resourcePath) {
    queryParams.set('filepath', resourcePath);
  }

  const queryString = queryParams.toString();

  return `/arbitrary/${service}/${encodeURIComponent(name)}${identifier ? `/${encodeURIComponent(identifier)}` : ''}${
    queryString ? `?${queryString}` : ''
  }`;
}

function buildQortalChatMessagesPath(request: QdnRequest) {
  const queryParams = new URLSearchParams({ encoding: 'BASE64' });
  const txGroupId = typeof request.txGroupId === 'number' ? request.txGroupId : Number(request.txGroupId);

  if (Number.isInteger(txGroupId)) {
    if (txGroupId < 0) {
      throw new Error('Group id must be a non-negative integer.');
    }

    queryParams.set('txGroupId', String(txGroupId));
  }

  for (const [requestKey, queryKey] of [
    ['after', 'after'],
    ['before', 'before'],
    ['chatReference', 'chatreference'],
    ['chatreference', 'chatreference'],
    ['encoding', 'encoding'],
    ['hasChatReference', 'haschatreference'],
    ['haschatreference', 'haschatreference'],
    ['limit', 'limit'],
    ['offset', 'offset'],
    ['reverse', 'reverse'],
    ['sender', 'sender'],
  ] as const) {
    appendQueryValue(queryParams, queryKey, request[requestKey]);
  }

  return `/chat/messages?${queryParams.toString()}`;
}

function buildQortalActiveChatsPath(request: QdnRequest) {
  const queryParams = new URLSearchParams({ encoding: 'BASE64' });

  for (const [requestKey, queryKey] of [
    ['encoding', 'encoding'],
    ['hasChatReference', 'haschatreference'],
    ['haschatreference', 'haschatreference'],
  ] as const) {
    appendQueryValue(queryParams, queryKey, request[requestKey]);
  }

  return `/chat/active/${encodeURIComponent(getRequiredAddress(request))}?${queryParams.toString()}`;
}

function getContentLength(response: Response, bodyLength: number) {
  const rawLength = response.headers.get('content-length');
  const contentLength = rawLength ? Number(rawLength) : bodyLength;

  return Number.isFinite(contentLength) ? contentLength : undefined;
}

async function fetchLocalNodeApi(request: QdnRequest): Promise<NodeApiFetchResult> {
  const method = sanitizeReadMethod(request.method);
  const apiPath = sanitizeNodePath(request.path);
  const response = await fetch(`${getNodeApiUrl()}${apiPath}`, { method });
  const contentType = response.headers.get('content-type') ?? '';
  const body = method === 'HEAD' ? '' : await response.text();
  const bodyLength = new TextEncoder().encode(body).byteLength;
  const maxBytes = typeof request.maxBytes === 'number' ? request.maxBytes : 0;

  if (maxBytes > 0 && bodyLength > maxBytes) {
    throw new Error(`Node API response exceeded the ${maxBytes.toLocaleString()} byte limit.`);
  }

  return {
    body,
    contentLength: getContentLength(response, bodyLength),
    contentType,
    data: parseResponseData(body, contentType),
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
  };
}

async function fetchLocalNodeApiData(request: QdnRequest, path: string) {
  const result = await fetchLocalNodeApi({ ...request, action: 'FETCH_NODE_API', path });

  if (!result.ok) {
    throw new Error(result.body || `Node API failed with HTTP ${result.status}.`);
  }

  return result.data;
}

function sanitizeQortalNodePath(path: string) {
  if (!path.startsWith('/') || path.startsWith('//') || /[\x00-\x1F]/.test(path)) {
    throw new Error('Qortal node API paths must start with /.');
  }

  const url = new URL(path, QORTAL_PUBLIC_NODE_API_URL);

  return `${url.pathname}${url.search}`;
}

async function fetchQortalNodeApi(request: QdnRequest, path: string): Promise<NodeApiFetchResult> {
  const method = sanitizeReadMethod(request.method);
  const apiPath = sanitizeQortalNodePath(path);
  const response = await fetch(`${QORTAL_PUBLIC_NODE_API_URL}${apiPath}`, { method });
  const contentType = response.headers.get('content-type') ?? '';
  const body = method === 'HEAD' ? '' : await response.text();
  const bodyLength = new TextEncoder().encode(body).byteLength;
  const maxBytes = typeof request.maxBytes === 'number' ? request.maxBytes : 0;

  if (maxBytes > 0 && bodyLength > maxBytes) {
    throw new Error(`Qortal node API response exceeded the ${maxBytes.toLocaleString()} byte limit.`);
  }

  return {
    body,
    contentLength: getContentLength(response, bodyLength),
    contentType,
    data: parseResponseData(body, contentType),
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
  };
}

async function fetchQortalNodeApiData(request: QdnRequest, path: string) {
  const result = await fetchQortalNodeApi(request, path);

  if (!result.ok) {
    throw new Error(result.body || `Qortal node request failed with HTTP ${result.status}.`);
  }

  return result.data;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }

  return btoa(binary);
}

async function fetchQortalResourceBinary(request: QdnRequest) {
  const apiPath = buildFetchQortalResourcePath(request);
  const response = await fetch(`${QORTAL_PUBLIC_NODE_API_URL}${apiPath}`);

  if (!response.ok) {
    throw new Error(`Qortal resource request failed with HTTP ${response.status}.`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const maxBytes = typeof request.maxBytes === 'number' ? request.maxBytes : 0;

  if (maxBytes > 0 && arrayBuffer.byteLength > maxBytes) {
    throw new Error(`Qortal resource exceeded the ${maxBytes.toLocaleString()} byte limit.`);
  }

  return {
    body: bytesToBase64(new Uint8Array(arrayBuffer)),
    contentLength: getContentLength(response, arrayBuffer.byteLength),
    contentType: response.headers.get('content-type') ?? 'application/octet-stream',
    encoding: 'base64' as const,
  };
}

async function getQortalPrimaryName(request: QdnRequest) {
  const address = getRequiredAddress(request);

  const result = await fetchQortalNodeApi(request, `/names/primary/${encodeURIComponent(address)}`);

  if (result.status === 404 || result.body.trim() === '') {
    return null;
  }

  if (!result.ok) {
    throw new Error(result.body || `Qortal node request failed with HTTP ${result.status}.`);
  }

  return result.data ?? null;
}

function getRequiredName(request: QdnRequest) {
  const name = getString(request.name) || getString(request.recipient);

  if (!name) {
    throw new Error('Name is required.');
  }

  return name;
}

async function getQortalNameData(request: QdnRequest) {
  const result = await fetchQortalNodeApi(request, `/names/${encodeURIComponent(getRequiredName(request))}`);

  if (result.status === 404 || result.body.trim() === '') {
    return null;
  }

  if (!result.ok) {
    throw new Error(result.body || `Qortal node request failed with HTTP ${result.status}.`);
  }

  return result.data ?? null;
}

function getRequiredSignature(request: QdnRequest) {
  const signature = getString(request.signature) || getString(request.txSignature);

  if (!signature) {
    throw new Error('Transaction signature is required.');
  }

  return signature;
}

async function getQortalTransaction(request: QdnRequest) {
  const result = await fetchQortalNodeApi(
    request,
    `/transactions/signature/${encodeURIComponent(getRequiredSignature(request))}`,
  );

  if (result.status === 404 || result.body.trim() === '') {
    return null;
  }

  if (!result.ok) {
    throw new Error(result.body || `Qortal node request failed with HTTP ${result.status}.`);
  }

  return result.data ?? null;
}

async function getQortalChatMessage(request: QdnRequest) {
  const result = await fetchQortalNodeApi(
    request,
    `/chat/message/${encodeURIComponent(getRequiredSignature(request))}?encoding=BASE64`,
  );

  if (result.status === 400 || result.status === 404 || result.body.trim() === '') {
    return null;
  }

  if (!result.ok) {
    throw new Error(result.body || `Qortal node request failed with HTTP ${result.status}.`);
  }

  return result.data ?? null;
}

export function resetLocalDemoAccountForTest() {
  localDemoAccountUnlocked = false;
}

function getLocalDemoAccount(): QdnSelectedAccount {
  return {
    ...LOCAL_DEMO_ACCOUNT,
    isUnlocked: localDemoAccountUnlocked,
  };
}

async function fallbackQdnRequest<T>(request: QdnRequest): Promise<T> {
  switch (request.action.toUpperCase()) {
    case 'FETCH_NODE_API':
      return (await fetchLocalNodeApi(request)) as T;
    case 'FETCH_QDN_RESOURCE':
      return (await fetchLocalNodeApiData(request, buildFetchQdnResourcePath(request))) as T;
    case 'FETCH_QORTAL_RESOURCE':
      return (await fetchQortalResourceBinary(request)) as T;
    case 'GET_QORT_BALANCE':
      return (await fetchQortalNodeApiData(
        request,
        `/addresses/balance/${encodeURIComponent(getRequiredAddress(request))}`,
      )) as T;
    case 'GET_NODE_STATUS':
      return (await fetchLocalNodeApiData(request, '/admin/status')) as T;
    case 'GET_QORTAL_ACCOUNT_NAMES':
      return (await fetchQortalNodeApiData(
        request,
        `/names/address/${encodeURIComponent(getRequiredAddress(request))}`,
      )) as T;
    case 'GET_QORTAL_ACCOUNT_GROUPS':
      return (await fetchQortalNodeApiData(
        request,
        `/groups/member/${encodeURIComponent(getRequiredAddress(request))}?limit=0&reverse=true`,
      )) as T;
    case 'GET_QORTAL_ACTIVE_CHATS':
      return (await fetchQortalNodeApiData(request, buildQortalActiveChatsPath(request))) as T;
    case 'GET_QORTAL_CHAT_MESSAGE':
      return (await getQortalChatMessage(request)) as T;
    case 'GET_QORTAL_CHAT_MESSAGES':
      return (await fetchQortalNodeApiData(request, buildQortalChatMessagesPath(request))) as T;
    case 'GET_QORTAL_NAME_DATA':
      return (await getQortalNameData(request)) as T;
    case 'GET_QORTAL_NODE_STATUS':
      return (await fetchQortalNodeApiData(request, '/admin/status')) as T;
    case 'GET_QORTAL_PRIMARY_NAME':
      return (await getQortalPrimaryName(request)) as T;
    case 'GET_QORTAL_TRANSACTION':
      return (await getQortalTransaction(request)) as T;
    case 'GET_QORTAL_RESOURCE_URL':
      return { url: `${QORTAL_PUBLIC_NODE_API_URL}${buildFetchQortalResourcePath(request)}` } as T;
    case 'GET_SELECTED_ACCOUNT':
      return getLocalDemoAccount() as T;
    case 'IS_USING_PUBLIC_NODE':
      return false as T;
    case 'LIST_QDN_RESOURCES':
      return (await fetchLocalNodeApiData(request, buildQdnResourcesPath(request, '/arbitrary/resources'))) as T;
    case 'SEARCH_QDN_RESOURCES':
      return (await fetchLocalNodeApiData(request, buildQdnResourcesPath(request, '/arbitrary/resources/search'))) as T;
    case 'SHOW_ACTIONS':
      return [...LOCAL_AVAILABLE_ACTIONS] as T;
    case 'UNLOCK_SELECTED_ACCOUNT':
      localDemoAccountUnlocked = true;
      return getLocalDemoAccount() as T;
    case 'WHICH_UI':
      return 'BROWSER_DEV' as T;
    default:
      throw new Error(`${request.action} is not available in local browser development.`);
  }
}

export function hasHomeBridge() {
  return typeof window !== 'undefined' && typeof window.qdnRequest === 'function';
}

export async function qdnRequest<T = unknown>(request: QdnRequest): Promise<T> {
  if (!isRecord(request) || typeof request.action !== 'string') {
    throw new Error('QDN requests must include an action.');
  }

  const bridgeRequest = typeof window !== 'undefined' ? window.qdnRequest : undefined;

  if (typeof bridgeRequest === 'function') {
    return bridgeRequest<T>(request);
  }

  return fallbackQdnRequest<T>(request);
}

export async function getBridgeState(): Promise<BridgeState> {
  let actions: string[] = [];
  let ui = hasHomeBridge() ? 'QORTIUM_HOME' : 'BROWSER_DEV';

  try {
    const requestedActions = await qdnRequest<unknown>({ action: 'SHOW_ACTIONS' });

    actions = Array.isArray(requestedActions)
      ? requestedActions.filter((action): action is string => typeof action === 'string')
      : [];
  } catch {
    actions = [...LOCAL_READ_ACTIONS];
  }

  try {
    const requestedUi = await qdnRequest<unknown>({ action: 'WHICH_UI' });

    if (typeof requestedUi === 'string' && requestedUi) {
      ui = requestedUi;
    }
  } catch {
    // Keep inferred UI.
  }

  return {
    actions,
    isHomeBridge: hasHomeBridge(),
    ui,
  };
}
