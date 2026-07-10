import { hasAction } from './account';
import { qdnRequest } from './qdnRequest';
import type { BridgeState } from './types';

// Home rejects OPEN_NEW_TAB addresses longer than this.
const QDN_LINK_MAX_LENGTH = 2048;
const QDN_LINK_PATTERN = /qdn:\/\/[^\s<>"'`]+/gi;
const TRAILING_PUNCTUATION_PATTERN = /[.,;:!?]+$/;

export type QdnTextSegment = {
  kind: 'link' | 'text';
  value: string;
};

function countOccurrences(value: string, character: string) {
  let count = 0;

  for (const candidate of value) {
    if (candidate === character) {
      count += 1;
    }
  }

  return count;
}

function trimTrailingPunctuation(link: string) {
  let trimmed = link.replace(TRAILING_PUNCTUATION_PATTERN, '');

  // Closing brackets stay only while an opener inside the link balances them,
  // so "(see qdn://APP/Name)" does not swallow the ")".
  while (
    (trimmed.endsWith(')') && countOccurrences(trimmed, ')') > countOccurrences(trimmed, '(')) ||
    (trimmed.endsWith(']') && countOccurrences(trimmed, ']') > countOccurrences(trimmed, '['))
  ) {
    trimmed = trimmed.slice(0, -1).replace(TRAILING_PUNCTUATION_PATTERN, '');
  }

  return trimmed;
}

export function isOpenableQdnLink(value: string) {
  const link = value.trim();

  return /^qdn:\/\/\S+$/i.test(link) && link.length > 'qdn://'.length && link.length <= QDN_LINK_MAX_LENGTH;
}

export function splitTextByQdnLinks(text: string): QdnTextSegment[] {
  const segments: QdnTextSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(QDN_LINK_PATTERN)) {
    const link = trimTrailingPunctuation(match[0]);

    if (!isOpenableQdnLink(link)) {
      continue;
    }

    if (match.index > lastIndex) {
      segments.push({ kind: 'text', value: text.slice(lastIndex, match.index) });
    }

    segments.push({ kind: 'link', value: link });
    lastIndex = match.index + link.length;
  }

  if (lastIndex < text.length || segments.length === 0) {
    segments.push({ kind: 'text', value: text.slice(lastIndex) });
  }

  return segments;
}

export function canOpenQdnLinks(bridgeState: BridgeState | null) {
  return hasAction(bridgeState?.actions, 'OPEN_NEW_TAB');
}

export async function openQdnLink(address: string) {
  const link = address.trim();

  if (!isOpenableQdnLink(link)) {
    throw new Error('Only qdn:// links can be opened.');
  }

  await qdnRequest<boolean>({ action: 'OPEN_NEW_TAB', address: link });
}
