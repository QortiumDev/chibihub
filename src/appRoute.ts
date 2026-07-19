export type ChibiHubRoute =
  | { view: 'dashboard' }
  | { groupId: number | null; view: 'chat' };

const APP_ROUTE_KEYS = ['group', 'view'] as const;

function parseGroupId(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) {
    return null;
  }

  const groupId = Number(value);
  return Number.isSafeInteger(groupId) && groupId > 0 ? groupId : null;
}

export function readChibiHubRoute(input: string | URL): ChibiHubRoute {
  const url = input instanceof URL ? input : new URL(input, 'http://localhost');
  const groupId = parseGroupId(url.searchParams.get('group'));

  if (url.searchParams.get('view') === 'chat' || groupId !== null) {
    return { groupId, view: 'chat' };
  }

  return { view: 'dashboard' };
}

export function getChibiHubRouteUrl(input: string | URL, route: ChibiHubRoute): URL {
  const url = input instanceof URL ? new URL(input.href) : new URL(input, 'http://localhost');

  for (const key of APP_ROUTE_KEYS) {
    url.searchParams.delete(key);
  }

  if (route.view === 'chat') {
    url.searchParams.set('view', 'chat');
    if (route.groupId !== null) {
      url.searchParams.set('group', String(route.groupId));
    }
  }

  return url;
}

export function resolveChatGroupId(
  requestedGroupId: number | null,
  availableGroupIds: readonly number[],
): number | null {
  if (requestedGroupId !== null && availableGroupIds.includes(requestedGroupId)) {
    return requestedGroupId;
  }

  return availableGroupIds[0] ?? null;
}
