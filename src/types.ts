export type BridgeState = {
  actions: string[];
  isHomeBridge: boolean;
  ui: string;
};

export type QdnSelectedAccount = {
  address: string;
  avatarUrl: string | null;
  id?: string;
  isUnlocked: boolean;
  name: string | null;
  resourceUrl?: string;
};

export type NodeApiFetchResult = {
  body: string;
  contentLength?: number;
  contentType: string;
  data: unknown;
  ok: boolean;
  status: number;
  statusText: string;
};

export type QdnResource = {
  created?: number;
  description?: string;
  identifier?: string;
  name?: string;
  service?: string;
  size?: number;
  status?: string;
  title?: string;
  updated?: number;
  [key: string]: unknown;
};

export type NodeStatus = {
  height?: number;
  isSynchronizing?: boolean;
  numberOfConnections?: number;
  syncPercent?: number;
  syncPhase?: string;
  [key: string]: unknown;
};

export type QortalNameData = {
  name?: string;
  owner?: string;
  [key: string]: unknown;
};

export type QortalTransaction = {
  blockHeight?: number;
  height?: number;
  signature?: string;
  timestamp?: number;
  type?: string;
  [key: string]: unknown;
};

export type SendQortResult =
  | {
      accepted: true;
      action: 'SEND_QORT';
      amount: string;
      fee: string;
      recipient: string;
      recipientName?: string | null;
      result?: unknown;
      signature: string;
    }
  | {
      accepted: false;
      canceled: true;
      reason: 'USER_CANCELLED';
    }
  | {
      accepted: false;
      error: string;
      errorType: 'VALIDATION_FAILED' | 'BROADCAST_REJECTED';
      recipient?: string;
      recipientName?: string | null;
      signature?: string;
    };

export type SendQortalGroupChatResult =
  | {
      accepted: true;
      action: 'SEND_QORTAL_GROUP_CHAT';
      groupId: number;
      groupName?: string;
      repliedTo?: string | null;
      result?: unknown;
      signature: string;
      specialId?: string;
    }
  | {
      accepted: false;
      canceled: true;
      reason: 'USER_CANCELLED';
    }
  | {
      accepted: false;
      error: string;
      errorType: 'VALIDATION_FAILED' | 'BROADCAST_REJECTED';
      groupId?: number;
      groupName?: string;
      signature?: string;
      specialId?: string;
    };

export type QortalChatMessage = {
  chatReference?: string;
  data?: string;
  encoding?: string;
  isEncrypted?: boolean;
  sender?: string;
  senderName?: string;
  signature?: string;
  timestamp?: number;
  txGroupId?: number;
  [key: string]: unknown;
};

export type QortalChatImageRef = {
  identifier: string;
  name: string;
  service: string;
  timestamp?: number;
};

export type QortalActiveGroupChat = QortalChatMessage & {
  groupId?: number;
  groupName?: string;
};

export type QortalActiveChats = {
  direct?: QortalChatMessage[];
  groups?: QortalActiveGroupChat[];
};
