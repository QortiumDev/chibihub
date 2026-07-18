import { formatAddress, hasAction } from './account';
import { decodeChatMessage, type DecodedChatMessage } from './chatDecoder';
import { qdnRequest } from './qdnRequest';
import type {
  BridgeState,
  QdnSelectedAccount,
  QortalAccountGroup,
  QortalActiveChats,
  QortalActiveGroupChat,
  QortalChatImageRef,
  QortalChatMessage,
} from './types';

export const CHAT_POLL_INTERVAL_MS = 20000;
export const CHAT_MESSAGE_LIMIT = 50;

export type ChatGroupSummary = {
  groupId: number;
  groupName: string;
  isOpen: boolean | null;
  lastMessagePreview: string;
  senderLabel: string;
  timestamp: number;
};

export type ChatMessageView = {
  decoded: DecodedChatMessage;
  editTimestamp: number | null;
  isOwn: boolean;
  reactions: ChatReactionSummary[];
  sender: string;
  senderLabel: string;
  senderName: string | null;
  signature: string;
  timestamp: number;
};

export type ChatReactionSummary = {
  count: number;
  emoji: string;
  isOwn: boolean;
};

export type MapChatMessagesOptions = {
  isPrivateGroup?: boolean;
};

export type ReplyPreview = {
  senderLabel: string;
  text: string;
};

export type OptimisticChatMessageInput = {
  account: QdnSelectedAccount;
  repliedTo?: string | null;
  senderLabel: string;
  senderName: string | null;
  signature: string;
  specialId?: string | null;
  text: string;
  timestamp?: number;
};

function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function canReadQortalGroupChat(bridgeState: BridgeState | null) {
  return (
    hasAction(bridgeState?.actions, 'GET_QORTAL_ACTIVE_CHATS') &&
    hasAction(bridgeState?.actions, 'GET_QORTAL_CHAT_MESSAGES')
  );
}

export function canFetchQortalChatMessage(bridgeState: BridgeState | null) {
  return hasAction(bridgeState?.actions, 'GET_QORTAL_CHAT_MESSAGE');
}

export function canLoadQortalAccountGroups(bridgeState: BridgeState | null) {
  return hasAction(bridgeState?.actions, 'GET_QORTAL_ACCOUNT_GROUPS');
}

function senderLabel(message: Pick<QortalChatMessage, 'sender' | 'senderName'>) {
  return message.senderName?.trim() || formatAddress(message.sender || '');
}

function getEncryptedGroupMessage(): DecodedChatMessage {
  return {
    encrypted: true,
    images: [],
    isEdited: false,
    kind: 'message',
    qortalLinks: [],
    reaction: null,
    repliedTo: null,
    specialId: null,
    text: '[encrypted group message]',
    unsupported: false,
  };
}

function toRawView(
  message: QortalChatMessage,
  account: QdnSelectedAccount,
  isPrivateGroup: boolean,
): ChatMessageView & { chatReference: string } {
  const signature = typeof message.signature === 'string' ? message.signature : '';

  return {
    chatReference: typeof message.chatReference === 'string' ? message.chatReference : '',
    decoded: isPrivateGroup ? getEncryptedGroupMessage() : decodeChatMessage(message),
    editTimestamp: null,
    isOwn: message.sender === account.address,
    reactions: [],
    sender: message.sender || '',
    senderLabel: senderLabel(message),
    senderName: message.senderName?.trim() || null,
    signature,
    timestamp: asNumber(message.timestamp) ?? 0,
  };
}

function cloneDecodedWithEdit(decoded: DecodedChatMessage, edit: DecodedChatMessage): DecodedChatMessage {
  return {
    ...edit,
    isEdited: true,
    kind: 'message',
    repliedTo: edit.repliedTo || decoded.repliedTo,
  };
}

function sortRowsAscending(rows: QortalChatMessage[]) {
  return rows
    .slice()
    .sort((left, right) => (asNumber(left.timestamp) ?? 0) - (asNumber(right.timestamp) ?? 0));
}

function summarizeReactions(
  reactionsBySignature: Map<string, Map<string, Map<string, { sender: string; timestamp: number }>>>,
  signature: string,
  account: QdnSelectedAccount,
): ChatReactionSummary[] {
  const reactions = reactionsBySignature.get(signature);

  if (!reactions) {
    return [];
  }

  return Array.from(reactions.entries())
    .map(([emoji, senders]) => ({
      count: senders.size,
      emoji,
      isOwn: Array.from(senders.values()).some((reaction) => reaction.sender === account.address),
    }))
    .filter((reaction) => reaction.count > 0)
    .sort((left, right) => left.emoji.localeCompare(right.emoji));
}

export function getReplyPreview(message: ChatMessageView): ReplyPreview {
  return {
    senderLabel: message.senderLabel,
    text: message.decoded.text,
  };
}

export function createOptimisticChatMessage(input: OptimisticChatMessageInput): ChatMessageView {
  return {
    decoded: {
      encrypted: false,
      images: [],
      isEdited: false,
      kind: 'message',
      qortalLinks: [],
      reaction: null,
      repliedTo: input.repliedTo?.trim() || null,
      specialId: input.specialId?.trim() || null,
      text: input.text,
      unsupported: false,
    },
    editTimestamp: null,
    isOwn: true,
    reactions: [],
    sender: input.account.address,
    senderLabel: input.senderLabel,
    senderName: input.senderName,
    signature: input.signature,
    timestamp: input.timestamp ?? Date.now(),
  };
}

export function filterPendingOptimisticMessages(
  loadedMessages: ChatMessageView[],
  optimisticMessages: ChatMessageView[],
) {
  const loadedSignatures = new Set(loadedMessages.map((message) => message.signature).filter(Boolean));
  const loadedSpecialIds = new Set(
    loadedMessages.map((message) => message.decoded.specialId).filter((specialId): specialId is string => Boolean(specialId)),
  );

  return optimisticMessages.filter((message) => {
    if (message.signature && loadedSignatures.has(message.signature)) {
      return false;
    }

    return !message.decoded.specialId || !loadedSpecialIds.has(message.decoded.specialId);
  });
}

export function mergeOptimisticChatMessages(
  loadedMessages: ChatMessageView[],
  optimisticMessages: ChatMessageView[],
) {
  const pendingOptimistic = filterPendingOptimisticMessages(loadedMessages, optimisticMessages);

  return [...loadedMessages, ...pendingOptimistic].sort((left, right) => left.timestamp - right.timestamp);
}

export function mapActiveGroupChats(
  payload: QortalActiveChats | unknown,
  accountGroups: QortalAccountGroup[] | unknown = [],
): ChatGroupSummary[] {
  const groups = payload && typeof payload === 'object' && 'groups' in payload ? (payload as QortalActiveChats).groups : [];
  const groupPrivacyById = new Map<number, boolean>();

  if (Array.isArray(accountGroups)) {
    for (const group of accountGroups) {
      const groupId = asNumber(group?.groupId);

      if (groupId != null && typeof group?.isOpen === 'boolean') {
        groupPrivacyById.set(groupId, group.isOpen);
      }
    }
  }

  if (!Array.isArray(groups)) {
    return [];
  }

  return groups
    .map((group: QortalActiveGroupChat) => {
      const groupId = asNumber(group.groupId);

      if (groupId == null) {
        return null;
      }

      const isOpen = groupPrivacyById.get(groupId) ?? null;
      const decoded = isOpen === false ? getEncryptedGroupMessage() : decodeChatMessage(group);

      return {
        groupId,
        groupName: group.groupName?.trim() || `Group ${groupId}`,
        isOpen,
        lastMessagePreview: decoded.text || '[unsupported message]',
        senderLabel: senderLabel(group),
        timestamp: asNumber(group.timestamp) ?? 0,
      };
    })
    .filter((group): group is ChatGroupSummary => group != null)
    .sort((left, right) => right.timestamp - left.timestamp);
}

export function mapChatMessages(
  payload: unknown,
  account: QdnSelectedAccount,
  options: MapChatMessagesOptions = {},
): ChatMessageView[] {
  const rows = Array.isArray(payload) ? sortRowsAscending(payload) : [];
  const baseMessages: ChatMessageView[] = [];
  const baseBySignature = new Map<string, ChatMessageView>();
  const latestEdits = new Map<string, ChatMessageView>();
  const reactions = new Map<string, Map<string, Map<string, { sender: string; timestamp: number }>>>();

  for (const row of rows) {
    const view = toRawView(row, account, options.isPrivateGroup === true);

    if (!view.signature && !view.timestamp && !view.decoded.text) {
      continue;
    }

    if (view.chatReference && view.decoded.kind === 'edit') {
      const currentEdit = latestEdits.get(view.chatReference);

      if (!currentEdit || view.timestamp >= currentEdit.timestamp) {
        latestEdits.set(view.chatReference, view);
      }

      continue;
    }

    if (view.chatReference && view.decoded.kind === 'reaction' && view.decoded.reaction) {
      const reaction = view.decoded.reaction;
      const byEmoji = reactions.get(view.chatReference) ?? new Map<string, Map<string, { sender: string; timestamp: number }>>();
      const bySender = byEmoji.get(reaction.content) ?? new Map<string, { sender: string; timestamp: number }>();
      const existing = bySender.get(view.sender);

      if (!existing || view.timestamp >= existing.timestamp) {
        if (reaction.contentState === false) {
          bySender.delete(view.sender);
        } else {
          bySender.set(view.sender, { sender: view.sender, timestamp: view.timestamp });
        }
      }

      if (bySender.size > 0) {
        byEmoji.set(reaction.content, bySender);
      } else {
        byEmoji.delete(reaction.content);
      }

      if (byEmoji.size > 0) {
        reactions.set(view.chatReference, byEmoji);
      } else {
        reactions.delete(view.chatReference);
      }

      continue;
    }

    baseMessages.push(view);

    if (view.signature) {
      baseBySignature.set(view.signature, view);
    }
  }

  for (const [signature, edit] of latestEdits.entries()) {
    const base = baseBySignature.get(signature);

    if (!base) {
      continue;
    }

    base.decoded = cloneDecodedWithEdit(base.decoded, edit.decoded);
    base.editTimestamp = edit.timestamp;
  }

  for (const message of baseMessages) {
    message.reactions = summarizeReactions(reactions, message.signature, account);
  }

  return baseMessages;
}

export async function loadActiveGroupChats(account: QdnSelectedAccount, bridgeState: BridgeState | null) {
  const [payload, accountGroups] = await Promise.all([
    qdnRequest<QortalActiveChats>({
      action: 'GET_QORTAL_ACTIVE_CHATS',
      address: account.address,
      encoding: 'BASE64',
    }),
    canLoadQortalAccountGroups(bridgeState)
      ? qdnRequest<QortalAccountGroup[]>({
          action: 'GET_QORTAL_ACCOUNT_GROUPS',
          address: account.address,
        }).catch(() => [])
      : Promise.resolve([]),
  ]);

  return mapActiveGroupChats(payload, accountGroups);
}

export async function loadGroupChatMessages(
  groupId: number,
  account: QdnSelectedAccount,
  options: MapChatMessagesOptions = {},
) {
  const payload = await qdnRequest<unknown>({
    action: 'GET_QORTAL_CHAT_MESSAGES',
    before: Date.now(),
    encoding: 'BASE64',
    limit: CHAT_MESSAGE_LIMIT,
    reverse: true,
    txGroupId: groupId,
  });

  return mapChatMessages(payload, account, options);
}

export async function loadChatMessageBySignature(signature: string, account: QdnSelectedAccount) {
  const payload = await qdnRequest<QortalChatMessage | null>({
    action: 'GET_QORTAL_CHAT_MESSAGE',
    signature,
  });

  if (!payload) {
    return null;
  }

  return mapChatMessages([payload], account)[0] ?? null;
}

export function hasImages(images: QortalChatImageRef[]) {
  return images.length > 0;
}
