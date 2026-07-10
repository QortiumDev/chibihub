import { describe, expect, it } from 'vitest';
import {
  canReadQortalGroupChat,
  createOptimisticChatMessage,
  mapActiveGroupChats,
  mapChatMessages,
  mergeOptimisticChatMessages,
} from './chatData';
import type { QdnSelectedAccount } from './types';

const account: QdnSelectedAccount = {
  address: 'QSenderAddress',
  avatarUrl: null,
  isUnlocked: true,
  name: null,
};

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function base64Json(value: unknown) {
  return bytesToBase64(new TextEncoder().encode(JSON.stringify(value)));
}

function messageText(text: string, extra: Record<string, unknown> = {}) {
  return {
    ...extra,
    messageText: {
      content: [{ content: [{ text, type: 'text' }], type: 'paragraph' }],
      type: 'doc',
    },
    version: 3,
  };
}

describe('chatData bridge support', () => {
  it('requires both Qortal chat actions', () => {
    expect(
      canReadQortalGroupChat({
        actions: ['GET_QORTAL_ACTIVE_CHATS', 'GET_QORTAL_CHAT_MESSAGES'],
        isHomeBridge: true,
        ui: 'QORTIUM_HOME',
      }),
    ).toBe(true);
    expect(
      canReadQortalGroupChat({
        actions: ['GET_QORTAL_ACTIVE_CHATS'],
        isHomeBridge: true,
        ui: 'QORTIUM_HOME',
      }),
    ).toBe(false);
  });
});

describe('mapActiveGroupChats', () => {
  it('maps group previews newest first', () => {
    const groups = mapActiveGroupChats({
      groups: [
        {
          data: base64Json(messageText('older')),
          encoding: 'BASE64',
          groupId: 2,
          groupName: 'Older',
          senderName: 'Alice',
          timestamp: 10,
        },
        {
          data: base64Json(messageText('newer')),
          encoding: 'BASE64',
          groupId: 1,
          groupName: 'Newer',
          senderName: 'Bob',
          timestamp: 20,
        },
      ],
    });

    expect(groups.map((group) => group.groupName)).toEqual(['Newer', 'Older']);
    expect(groups[0]).toMatchObject({ lastMessagePreview: 'newer', senderLabel: 'Bob' });
  });
});

describe('mapChatMessages edits and reactions', () => {
  it('dedupes successive edit references into the original message position', () => {
    const messages = mapChatMessages(
      [
        {
          data: base64Json(messageText('original')),
          encoding: 'BASE64',
          sender: 'QOther',
          senderName: 'Other',
          signature: 'original-sig',
          timestamp: 10,
        },
        {
          chatReference: 'original-sig',
          data: base64Json(messageText('first edit', { isEdited: true, type: 'edit' })),
          encoding: 'BASE64',
          sender: 'QOther',
          senderName: 'Other',
          signature: 'edit-one',
          timestamp: 20,
        },
        {
          chatReference: 'original-sig',
          data: base64Json(messageText('latest edit', { isEdited: true, type: 'edit' })),
          encoding: 'BASE64',
          sender: 'QOther',
          senderName: 'Other',
          signature: 'edit-two',
          timestamp: 30,
        },
      ],
      account,
    );

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      editTimestamp: 30,
      signature: 'original-sig',
      timestamp: 10,
    });
    expect(messages[0].decoded).toMatchObject({ isEdited: true, text: 'latest edit' });
  });

  it('aggregates reaction references and handles remove toggles by sender timestamp', () => {
    const messages = mapChatMessages(
      [
        {
          data: base64Json(messageText('target')),
          encoding: 'BASE64',
          sender: 'QOther',
          senderName: 'Other',
          signature: 'target-sig',
          timestamp: 10,
        },
        {
          chatReference: 'target-sig',
          data: base64Json({ content: '👍', contentState: true, message: '', type: 'reaction' }),
          encoding: 'BASE64',
          sender: account.address,
          senderName: 'Me',
          signature: 'reaction-add',
          timestamp: 20,
        },
        {
          chatReference: 'target-sig',
          data: base64Json({ content: '👍', contentState: true, message: '', type: 'reaction' }),
          encoding: 'BASE64',
          sender: 'QThird',
          senderName: 'Third',
          signature: 'reaction-third',
          timestamp: 25,
        },
        {
          chatReference: 'target-sig',
          data: base64Json({ content: '👍', contentState: false, message: '', type: 'reaction' }),
          encoding: 'BASE64',
          sender: account.address,
          senderName: 'Me',
          signature: 'reaction-remove',
          timestamp: 30,
        },
      ],
      account,
    );

    expect(messages).toHaveLength(1);
    expect(messages[0].reactions).toEqual([{ count: 1, emoji: '👍', isOwn: false }]);
  });
});

describe('mapChatMessages', () => {
  it('reverses reverse=true API rows into oldest-to-newest display order', () => {
    const messages = mapChatMessages(
      [
        {
          data: base64Json(messageText('newest')),
          encoding: 'BASE64',
          sender: account.address,
          signature: 'new',
          timestamp: 20,
        },
        {
          data: base64Json(messageText('oldest')),
          encoding: 'BASE64',
          sender: 'QOther',
          senderName: 'Other',
          signature: 'old',
          timestamp: 10,
        },
      ],
      account,
    );

    expect(messages.map((message) => message.decoded.text)).toEqual(['oldest', 'newest']);
    expect(messages[0].isOwn).toBe(false);
    expect(messages[1].isOwn).toBe(true);
  });

  it('provides reply previews with sender labels', () => {
    const messages = mapChatMessages(
      [
        {
          data: base64Json(messageText('quoted')),
          encoding: 'BASE64',
          sender: 'QOther',
          senderName: 'Other',
          signature: 'quoted-sig',
          timestamp: 10,
        },
        {
          data: base64Json(messageText('reply', { repliedTo: 'quoted-sig' })),
          encoding: 'BASE64',
          sender: account.address,
          signature: 'reply-sig',
          timestamp: 20,
        },
      ],
      account,
    );

    expect(messages[1].decoded.repliedTo).toBe('quoted-sig');
    expect(messages[0].senderLabel).toBe('Other');
  });
});

describe('optimistic chat messages', () => {
  it('creates an own-account optimistic message with sender identity', () => {
    const optimistic = createOptimisticChatMessage({
      account,
      repliedTo: 'reply-sig',
      senderLabel: 'QuickMythril',
      senderName: 'QuickMythril',
      signature: 'optimistic-sig',
      specialId: 'special-1',
      text: 'sent now',
      timestamp: 100,
    });

    expect(optimistic).toMatchObject({
      isOwn: true,
      sender: account.address,
      senderLabel: 'QuickMythril',
      senderName: 'QuickMythril',
      signature: 'optimistic-sig',
      timestamp: 100,
    });
    expect(optimistic.decoded).toMatchObject({
      repliedTo: 'reply-sig',
      specialId: 'special-1',
      text: 'sent now',
    });
  });

  it('keeps optimistic messages until the server returns their signature or specialId', () => {
    const optimistic = createOptimisticChatMessage({
      account,
      senderLabel: 'QuickMythril',
      senderName: 'QuickMythril',
      signature: 'optimistic-sig',
      specialId: 'special-1',
      text: 'sent now',
      timestamp: 20,
    });
    const loaded = mapChatMessages(
      [
        {
          data: base64Json(messageText('older')),
          encoding: 'BASE64',
          sender: 'QOther',
          senderName: 'Other',
          signature: 'old-sig',
          timestamp: 10,
        },
      ],
      account,
    );

    expect(mergeOptimisticChatMessages(loaded, [optimistic]).map((message) => message.signature)).toEqual([
      'old-sig',
      'optimistic-sig',
    ]);

    const reconciled = mapChatMessages(
      [
        {
          data: base64Json(messageText('sent now', { specialId: 'special-1' })),
          encoding: 'BASE64',
          sender: account.address,
          senderName: 'QuickMythril',
          signature: 'real-sig',
          timestamp: 30,
        },
      ],
      account,
    );

    expect(mergeOptimisticChatMessages(reconciled, [optimistic]).map((message) => message.signature)).toEqual([
      'real-sig',
    ]);
  });
});
