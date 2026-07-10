import { describe, expect, it } from 'vitest';
import { decodeChatMessage } from './chatDecoder';
import type { QortalChatMessage } from './types';

function base64Json(value: unknown) {
  return bytesToBase64(new TextEncoder().encode(JSON.stringify(value)));
}

function base64Text(value: string) {
  return bytesToBase64(new TextEncoder().encode(value));
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

describe('decodeChatMessage', () => {
  it('extracts plain text, replies, and edited state from Hub v3 tiptap messages', () => {
    const decoded = decodeChatMessage({
      data: base64Json({
        isEdited: true,
        messageText: {
          content: [
            {
              content: [
                { text: 'Hello', type: 'text' },
                { type: 'hardBreak' },
                { text: 'Qortal', type: 'text' },
              ],
              type: 'paragraph',
            },
          ],
          type: 'doc',
        },
        repliedTo: 'reply-signature',
        version: 3,
      }),
      encoding: 'BASE64',
    });

    expect(decoded).toMatchObject({
      images: [],
      isEdited: true,
      kind: 'edit',
      repliedTo: 'reply-signature',
      text: 'Hello\nQortal',
      unsupported: false,
    });
  });

  it('parses image attachment refs from v3 messages', () => {
    const decoded = decodeChatMessage({
      data: base64Json({
        images: [{ identifier: 'img-id', name: 'QuickMythril', service: 'IMAGE', timestamp: 1783403484577 }],
        isEdited: false,
        messageText: null,
        type: '',
        version: 3,
      }),
      encoding: 'BASE64',
    });

    expect(decoded).toMatchObject({
      images: [{ identifier: 'img-id', name: 'QuickMythril', service: 'IMAGE' }],
      text: '[image]',
      unsupported: false,
    });
  });

  it('parses reaction payloads', () => {
    const decoded = decodeChatMessage({
      data: base64Json({
        content: '👍',
        contentState: false,
        message: '',
        specialId: 'reaction-id',
        type: 'reaction',
      }),
      encoding: 'BASE64',
    });

    expect(decoded).toMatchObject({
      kind: 'reaction',
      reaction: { content: '👍', contentState: false },
      text: '👍',
    });
  });

  it('handles plain text payloads', () => {
    expect(decodeChatMessage({ data: base64Text('plain hello'), encoding: 'BASE64' }).text).toBe('plain hello');
  });

  it('uses best-effort text for older json shapes', () => {
    expect(decodeChatMessage({ data: base64Json({ message: 'old format' }), encoding: 'BASE64' }).text).toBe(
      'old format',
    );
  });

  it('marks unknown json as unsupported', () => {
    expect(decodeChatMessage({ data: base64Json({ strange: true }), encoding: 'BASE64' })).toMatchObject({
      text: '[unsupported message]',
      unsupported: true,
    });
  });

  it('labels encrypted messages without decoding data', () => {
    expect(decodeChatMessage({ data: 'not-base64', isEncrypted: true })).toMatchObject({
      encrypted: true,
      text: '[encrypted DM]',
    });
  });

  it('marks invalid base64 as unsupported', () => {
    expect(decodeChatMessage({ data: '***', encoding: 'BASE64' })).toMatchObject({
      text: '[unsupported message]',
      unsupported: true,
    });
  });
});
