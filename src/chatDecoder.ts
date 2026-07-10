import type { QortalChatImageRef, QortalChatMessage } from './types';

export type DecodedChatMessage = {
  encrypted: boolean;
  images: QortalChatImageRef[];
  isEdited: boolean;
  kind: 'edit' | 'message' | 'reaction';
  qortalLinks: string[];
  reaction: {
    content: string;
    contentState: boolean;
  } | null;
  repliedTo: string | null;
  specialId: string | null;
  text: string;
  unsupported: boolean;
};

function decodeBase64Utf8(value: string) {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

  return new TextDecoder().decode(bytes);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function normalizeText(value: string) {
  return value.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function getQortalLinks(text: string) {
  return Array.from(new Set(text.match(/qortal:\/\/[^\s<>"']+/gi) ?? []));
}

function extractTiptapText(node: unknown): string {
  const record = asRecord(node);

  if (!record) {
    return '';
  }

  if (record.type === 'text') {
    return typeof record.text === 'string' ? record.text : '';
  }

  if (record.type === 'hardBreak') {
    return '\n';
  }

  const content = Array.isArray(record.content) ? record.content : [];
  const joined = content.map(extractTiptapText).join('');

  if (record.type === 'paragraph') {
    return `${joined}\n`;
  }

  return joined;
}

function bestEffortTextFromJson(value: unknown): { text: string; unsupported: boolean } {
  const record = asRecord(value);

  if (typeof value === 'string') {
    return { text: value, unsupported: false };
  }

  if (!record) {
    return { text: '[unsupported message]', unsupported: true };
  }

  for (const key of ['text', 'message', 'body']) {
    const candidate = record[key];

    if (typeof candidate === 'string' && candidate.trim()) {
      return { text: candidate, unsupported: false };
    }
  }

  if (typeof record.messageText === 'string' && record.messageText.trim()) {
    return { text: record.messageText, unsupported: false };
  }

  return { text: '[unsupported message]', unsupported: true };
}

function getImageRefs(value: unknown): QortalChatImageRef[] {
  const images = Array.isArray(value) ? value : [];
  const imageRefs: QortalChatImageRef[] = [];

  for (const image of images) {
    const record = asRecord(image);
    const name = typeof record?.name === 'string' ? record.name.trim() : '';
    const identifier = typeof record?.identifier === 'string' ? record.identifier.trim() : '';
    const service = typeof record?.service === 'string' ? record.service.trim().toUpperCase() : '';
    const timestamp = typeof record?.timestamp === 'number' ? record.timestamp : undefined;

    if (!name || !identifier || !service) {
      continue;
    }

    imageRefs.push({ identifier, name, service, timestamp });
  }

  return imageRefs;
}

function decodePayload(message: QortalChatMessage) {
  const payload = typeof message.data === 'string' ? message.data : '';
  const encoding = typeof message.encoding === 'string' ? message.encoding.toUpperCase() : 'BASE64';

  if (!payload) {
    return '';
  }

  if (encoding === 'BASE64') {
    return decodeBase64Utf8(payload);
  }

  return payload;
}

export function decodeChatMessage(message: QortalChatMessage): DecodedChatMessage {
  if (message.isEncrypted) {
    return {
      encrypted: true,
      images: [],
      isEdited: false,
      kind: 'message',
      qortalLinks: [],
      reaction: null,
      repliedTo: null,
      specialId: null,
      text: '[encrypted DM]',
      unsupported: false,
    };
  }

  let payload = '';

  try {
    payload = decodePayload(message);
  } catch {
    return {
      encrypted: false,
      images: [],
      isEdited: false,
      kind: 'message',
      qortalLinks: [],
      reaction: null,
      repliedTo: null,
      specialId: null,
      text: '[unsupported message]',
      unsupported: true,
    };
  }

  if (!payload.trim()) {
    return {
      encrypted: false,
      images: [],
      isEdited: false,
      kind: 'message',
      qortalLinks: [],
      reaction: null,
      repliedTo: null,
      specialId: null,
      text: '[unsupported message]',
      unsupported: true,
    };
  }

  try {
    const parsed = JSON.parse(payload) as unknown;
    const record = asRecord(parsed);

    if (record?.type === 'reaction') {
      const content = typeof record.content === 'string' ? record.content.trim() : '';

      return {
        encrypted: false,
        images: [],
        isEdited: false,
        kind: 'reaction',
        qortalLinks: [],
        reaction: content ? { content, contentState: record.contentState !== false } : null,
        repliedTo: null,
        specialId: typeof record.specialId === 'string' && record.specialId.trim() ? record.specialId.trim() : null,
        text: content || '[unsupported reaction]',
        unsupported: !content,
      };
    }

    if (record && record.version === 3) {
      const text = normalizeText(extractTiptapText(record.messageText));
      const images = getImageRefs(record.images);
      const visibleText = text || (images.length > 0 ? '[image]' : '[unsupported message]');

      return {
        encrypted: false,
        images,
        isEdited: record.isEdited === true,
        kind: record.type === 'edit' || record.isEdited === true ? 'edit' : 'message',
        qortalLinks: getQortalLinks(visibleText),
        reaction: null,
        repliedTo: typeof record.repliedTo === 'string' && record.repliedTo.trim() ? record.repliedTo.trim() : null,
        specialId: typeof record.specialId === 'string' && record.specialId.trim() ? record.specialId.trim() : null,
        text: visibleText,
        unsupported: !text && images.length === 0,
      };
    }

    const bestEffort = bestEffortTextFromJson(parsed);
    const text = normalizeText(bestEffort.text);

    return {
      encrypted: false,
      images: getImageRefs(record?.images),
      isEdited: record?.isEdited === true,
      kind: record?.type === 'edit' || record?.isEdited === true ? 'edit' : 'message',
      qortalLinks: getQortalLinks(text),
      reaction: null,
      repliedTo: typeof record?.repliedTo === 'string' && record.repliedTo.trim() ? record.repliedTo.trim() : null,
      specialId: typeof record?.specialId === 'string' && record.specialId.trim() ? record.specialId.trim() : null,
      text,
      unsupported: bestEffort.unsupported,
    };
  } catch {
    const text = normalizeText(payload);

    return {
      encrypted: false,
      images: [],
      isEdited: false,
      kind: 'message',
      qortalLinks: getQortalLinks(text),
    reaction: null,
    repliedTo: null,
    specialId: null,
    text,
    unsupported: false,
    };
  }
}
