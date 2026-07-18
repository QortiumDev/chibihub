import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { formatAddress } from './account';
import { expireFailedChatAvatarCache, loadChatAvatar } from './chatAvatars';
import {
  canFetchQortalChatMessage,
  canReadQortalGroupChat,
  CHAT_POLL_INTERVAL_MS,
  createOptimisticChatMessage,
  filterPendingOptimisticMessages,
  getReplyPreview,
  loadActiveGroupChats,
  loadChatMessageBySignature,
  loadGroupChatMessages,
  mergeOptimisticChatMessages,
  type ChatGroupSummary,
  type ChatMessageView,
  type ReplyPreview,
} from './chatData';
import { loadChatImage } from './chatImages';
import { canOpenQdnLinks, openQdnLink, splitTextByQdnLinks } from './qdnLinks';
import { QubinoMascot, type QubinoAction } from './QubinoMascot';
import { getQortalIdentityDisplayName, type QortalIdentity } from './qortalIdentity';
import {
  canSendQortalGroupChat,
  canSendToQortalGroup,
  isSendQortalGroupChatCancelled,
  sendQortalGroupChat,
} from './sendGroupChat';
import type { BridgeState, QdnSelectedAccount, QortalChatImageRef } from './types';

function getInitials(label: string) {
  const parts = label.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return label.slice(0, 2).toUpperCase() || 'Q';
}

function getRelativeTime(timestamp: number) {
  if (!timestamp) {
    return '';
  }

  const diffSeconds = Math.round((timestamp - Date.now()) / 1000);
  const absoluteSeconds = Math.abs(diffSeconds);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

  if (absoluteSeconds < 60) {
    return formatter.format(diffSeconds, 'second');
  }

  const diffMinutes = Math.round(diffSeconds / 60);

  if (Math.abs(diffMinutes) < 60) {
    return formatter.format(diffMinutes, 'minute');
  }

  const diffHours = Math.round(diffMinutes / 60);

  if (Math.abs(diffHours) < 24) {
    return formatter.format(diffHours, 'hour');
  }

  return formatter.format(Math.round(diffHours / 24), 'day');
}

function ChatAvatar({
  avatarRefreshKey,
  avatarUrlOverride = null,
  label,
  name,
}: {
  avatarRefreshKey: number;
  avatarUrlOverride?: string | null;
  label: string;
  name: string | null;
}) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let isActive = true;

    setAvatarUrl(avatarUrlOverride);
    setFailed(false);

    if (avatarUrlOverride) {
      return () => {
        isActive = false;
      };
    }

    if (!name) {
      return () => {
        isActive = false;
      };
    }

    void loadChatAvatar(name).then((url) => {
      if (isActive) {
        setAvatarUrl(url);
      }
    });

    return () => {
      isActive = false;
    };
  }, [avatarRefreshKey, avatarUrlOverride, name]);

  if (avatarUrl && !failed) {
    return <img className="chat-avatar" src={avatarUrl} alt="" onError={() => setFailed(true)} />;
  }

  return <div className="chat-avatar chat-avatar-fallback">{getInitials(label)}</div>;
}

function ChatImage({ image }: { image: QortalChatImageRef }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let isActive = true;

    setImageUrl(null);
    setFailed(false);

    void loadChatImage(image).then((url) => {
      if (isActive) {
        setImageUrl(url);
        setFailed(!url);
      }
    });

    return () => {
      isActive = false;
    };
  }, [image.identifier, image.name, image.service]);

  if (failed) {
    return <div className="chat-image-fallback">Image could not load</div>;
  }

  if (!imageUrl) {
    return <div className="chat-image-loading">Loading image...</div>;
  }

  return (
    <img
      className="chat-image"
      src={imageUrl}
      alt=""
      loading="lazy"
      onError={() => {
        setFailed(true);
      }}
    />
  );
}

function ChatMessageText({
  canOpenLinks,
  onOpenLink,
  text,
}: {
  canOpenLinks: boolean;
  onOpenLink: (address: string) => void;
  text: string;
}) {
  return (
    <p>
      {splitTextByQdnLinks(text).map((segment, index) =>
        segment.kind === 'link' ? (
          <button
            className="chat-link"
            disabled={!canOpenLinks}
            key={`${segment.value}-${index}`}
            title={canOpenLinks ? `Open ${segment.value} in a new tab` : 'Opening qdn:// links needs Qortium Home.'}
            type="button"
            onClick={() => onOpenLink(segment.value)}
          >
            {segment.value}
          </button>
        ) : (
          <span key={index}>{segment.value}</span>
        ),
      )}
    </p>
  );
}

function ChatMessageBubble({
  avatarRefreshKey,
  canOpenLinks,
  qortalIdentity,
  message,
  onOpenLink,
  onReply,
  replies,
}: {
  avatarRefreshKey: number;
  canOpenLinks: boolean;
  qortalIdentity: QortalIdentity | null;
  message: ChatMessageView;
  onOpenLink: (address: string) => void;
  onReply: (message: ChatMessageView) => void;
  replies: Map<string, ReplyPreview | null>;
}) {
  const reply = message.decoded.repliedTo ? replies.get(message.decoded.repliedTo) : undefined;
  const replyLabel = reply ? `${reply.senderLabel}: ${reply.text}` : 'replying to an earlier message';
  const shouldShowReply = Boolean(message.decoded.repliedTo);
  const shouldShowText = message.decoded.text && !(message.decoded.text === '[image]' && message.decoded.images.length > 0);
  const senderLabel = message.isOwn ? getQortalIdentityDisplayName(qortalIdentity) : message.senderLabel;
  const senderName = message.isOwn ? qortalIdentity?.name ?? message.senderName : message.senderName;
  const avatarUrl = message.isOwn ? qortalIdentity?.avatarUrl ?? null : null;

  return (
    <article className={`chat-message ${message.isOwn ? 'chat-message-own' : 'chat-message-other'}`}>
      <ChatAvatar
        avatarRefreshKey={avatarRefreshKey}
        avatarUrlOverride={avatarUrl}
        label={senderLabel}
        name={senderName}
      />
      <div className="chat-message-stack">
        <div className="chat-sender">{senderLabel}</div>
        <div className="chat-bubble">
          {shouldShowReply ? <div className="chat-quote">{replyLabel}</div> : null}
          {shouldShowText ? (
            <ChatMessageText canOpenLinks={canOpenLinks} onOpenLink={onOpenLink} text={message.decoded.text} />
          ) : null}
          {message.decoded.qortalLinks.length > 0 ? (
            <div className="chat-embed-chip-row">
              {message.decoded.qortalLinks.map((link) => (
                <span className="chat-embed-chip" key={link}>
                  Qortal embed: {link}
                </span>
              ))}
            </div>
          ) : null}
          {message.decoded.images.length > 0 ? (
            <div className="chat-image-grid">
              {message.decoded.images.map((image) => (
                <ChatImage image={image} key={`${image.service}/${image.name}/${image.identifier}`} />
              ))}
            </div>
          ) : null}
          <footer>
            {message.signature && !message.decoded.encrypted ? (
              <button className="chat-reply-button" type="button" onClick={() => onReply(message)}>
                Reply
              </button>
            ) : null}
            {message.decoded.isEdited ? <span>(edited)</span> : null}
            <time>{getRelativeTime(message.timestamp)}</time>
          </footer>
        </div>
        {message.reactions.length > 0 ? (
          <div className="chat-reaction-row">
            {message.reactions.map((reaction) => (
              <span className={reaction.isOwn ? 'chat-reaction-chip own' : 'chat-reaction-chip'} key={reaction.emoji}>
                <span>{reaction.emoji}</span>
                <strong>{reaction.count}</strong>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function ChatPage({
  account,
  bridgeState,
  onBackToDashboard,
  onRefreshIdentity,
  qortalIdentity,
}: {
  account: QdnSelectedAccount;
  bridgeState: BridgeState | null;
  onBackToDashboard: () => void;
  onRefreshIdentity: () => void;
  qortalIdentity: QortalIdentity | null;
}) {
  const [groups, setGroups] = useState<ChatGroupSummary[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [error, setError] = useState('');
  const [externalReplies, setExternalReplies] = useState<Record<string, ReplyPreview | null>>({});
  const [draftMessage, setDraftMessage] = useState('');
  const [replyTarget, setReplyTarget] = useState<ReplyPreview & { signature: string } | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendStatus, setSendStatus] = useState('');
  const [sendMascotAction, setSendMascotAction] = useState<QubinoAction>('idle');
  const [avatarRefreshKey, setAvatarRefreshKey] = useState(0);
  const [groupRefreshKey, setGroupRefreshKey] = useState(0);
  const [messageRefreshKey, setMessageRefreshKey] = useState(0);
  const feedRef = useRef<HTMLDivElement | null>(null);
  const optimisticMessagesRef = useRef<ChatMessageView[]>([]);
  const shouldScrollToBottomRef = useRef(true);
  const chatAvailable = canReadQortalGroupChat(bridgeState);
  const replyFetchAvailable = canFetchQortalChatMessage(bridgeState);
  const sendActionAvailable = canSendQortalGroupChat(bridgeState);
  const qdnLinksOpenable = canOpenQdnLinks(bridgeState);

  const selectedGroup = groups.find((group) => group.groupId === selectedGroupId) ?? null;
  const selectedGroupIsPrivate = selectedGroup?.isOpen === false;
  const sendAvailable = canSendToQortalGroup(bridgeState, selectedGroup);
  const ownSenderLabel = getQortalIdentityDisplayName(qortalIdentity);
  const boundAccountName = qortalIdentity?.name?.trim() || 'Selected Qortal account';
  const boundAccountAddress = formatAddress(account.address);

  function isFeedNearBottom() {
    const feed = feedRef.current;

    if (!feed) {
      return true;
    }

    return feed.scrollHeight - feed.scrollTop - feed.clientHeight <= 100;
  }

  function requestMessageRefresh({ forceBottom = false }: { forceBottom?: boolean } = {}) {
    shouldScrollToBottomRef.current = forceBottom || isFeedNearBottom();
    setMessageRefreshKey((current) => current + 1);
  }

  function requestFullRefresh() {
    expireFailedChatAvatarCache();
    onRefreshIdentity();
    setAvatarRefreshKey((current) => current + 1);
    setGroupRefreshKey((current) => current + 1);
    requestMessageRefresh();
  }

  function scrollFeedToBottom(behavior: ScrollBehavior = 'smooth') {
    const feed = feedRef.current;

    if (!feed) {
      return;
    }

    feed.scrollTo({ behavior, top: feed.scrollHeight });
  }

  const replyLookup = useMemo(() => {
    const lookup = new Map<string, ReplyPreview | null>();

    for (const message of messages) {
      if (message.signature) {
        lookup.set(message.signature, getReplyPreview(message));
      }
    }

    for (const [signature, reply] of Object.entries(externalReplies)) {
      lookup.set(signature, reply);
    }

    return lookup;
  }, [externalReplies, messages]);

  function handleOpenQdnLink(address: string) {
    void openQdnLink(address).catch((openError) => {
      setError(openError instanceof Error ? openError.message : String(openError));
    });
  }

  function setTemporaryMascotAction(action: QubinoAction, timeoutMs = 2800) {
    setSendMascotAction(action);
    window.setTimeout(() => {
      setSendMascotAction((current) => (current === action ? 'idle' : current));
    }, timeoutMs);
  }

  async function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedGroup || !sendAvailable || isSending) {
      return;
    }

    const text = draftMessage.trim();

    if (!text) {
      setSendStatus('Qubino needs a message before it can send.');
      setTemporaryMascotAction('failed');
      return;
    }

    setIsSending(true);
    setSendStatus('Qubino is handing the message to Home...');
    setSendMascotAction('waiting');

    try {
      const result = await sendQortalGroupChat({
        repliedTo: replyTarget?.signature,
        text,
        txGroupId: selectedGroup.groupId,
      });

      if (result.accepted) {
        const optimisticMessage = createOptimisticChatMessage({
          account,
          repliedTo: replyTarget?.signature,
          senderLabel: ownSenderLabel,
          senderName: qortalIdentity?.name ?? null,
          signature: result.signature,
          specialId: result.specialId,
          text,
        });

        optimisticMessagesRef.current = mergeOptimisticChatMessages(optimisticMessagesRef.current, [optimisticMessage]);
        setMessages((current) => mergeOptimisticChatMessages(current, [optimisticMessage]));
        setDraftMessage('');
        setReplyTarget(null);
        setSendStatus(`Broadcast accepted: ${result.signature}`);
        setTemporaryMascotAction('accepted', 3200);
        requestMessageRefresh({ forceBottom: true });
        return;
      }

      if (isSendQortalGroupChatCancelled(result)) {
        setSendStatus('Send cancelled. Nothing was broadcast.');
      } else {
        setSendStatus(result.error || 'Home could not send that message.');
      }

      setTemporaryMascotAction('failed');
    } catch (sendError) {
      setSendStatus(sendError instanceof Error ? sendError.message : String(sendError));
      setTemporaryMascotAction('failed');
    } finally {
      setIsSending(false);
    }
  }

  useEffect(() => {
    let isActive = true;

    if (!chatAvailable) {
      setIsLoadingGroups(false);
      setGroups([]);
      setSelectedGroupId(null);
      setMessages([]);
      optimisticMessagesRef.current = [];
      return () => {
        isActive = false;
      };
    }

    setIsLoadingGroups(true);
    setError('');

    void loadActiveGroupChats(account, bridgeState)
      .then((nextGroups) => {
        if (!isActive) {
          return;
        }

        setGroups(nextGroups);
        setSelectedGroupId((current) =>
          current != null && nextGroups.some((group) => group.groupId === current)
            ? current
            : (nextGroups[0]?.groupId ?? null),
        );
      })
      .catch((loadError) => {
        if (isActive) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingGroups(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [account, bridgeState, chatAvailable, groupRefreshKey]);

  useEffect(() => {
    if (!chatAvailable || selectedGroupId == null) {
      setMessages([]);
      return undefined;
    }

    let isActive = true;

    setExternalReplies({});

    async function refreshMessages(showLoading: boolean) {
      if (showLoading) {
        setIsLoadingMessages(true);
        shouldScrollToBottomRef.current = true;
      } else {
        shouldScrollToBottomRef.current = isFeedNearBottom();
      }

      try {
        const nextMessages = await loadGroupChatMessages(selectedGroupId as number, account, {
          isPrivateGroup: selectedGroupIsPrivate,
        });

        if (isActive) {
          const pendingOptimistic = filterPendingOptimisticMessages(nextMessages, optimisticMessagesRef.current);
          optimisticMessagesRef.current = pendingOptimistic;
          setMessages(mergeOptimisticChatMessages(nextMessages, pendingOptimistic));
        }
      } catch (loadError) {
        if (isActive) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      } finally {
        if (isActive && showLoading) {
          setIsLoadingMessages(false);
        }
      }
    }

    void refreshMessages(true);
    const intervalId = window.setInterval(() => {
      void refreshMessages(false);
    }, CHAT_POLL_INTERVAL_MS);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, [account, chatAvailable, messageRefreshKey, selectedGroupId, selectedGroupIsPrivate]);

  useEffect(() => {
    setReplyTarget(null);
    setSendStatus('');
    optimisticMessagesRef.current = [];
    shouldScrollToBottomRef.current = true;
  }, [selectedGroupId]);

  useLayoutEffect(() => {
    if (!shouldScrollToBottomRef.current) {
      return;
    }

    scrollFeedToBottom(messages.length > 0 ? 'smooth' : 'auto');
    shouldScrollToBottomRef.current = false;
  }, [messages]);

  useEffect(() => {
    if (!replyFetchAvailable) {
      return undefined;
    }

    const missingReplySignatures = Array.from(
      new Set(
        messages
          .map((message) => message.decoded.repliedTo)
          .filter((signature): signature is string => typeof signature === 'string' && !replyLookup.has(signature)),
      ),
    );

    if (missingReplySignatures.length === 0) {
      return undefined;
    }

    let isActive = true;

    for (const signature of missingReplySignatures) {
      void loadChatMessageBySignature(signature, account)
        .then((replyMessage) => {
          if (!isActive) {
            return;
          }

          setExternalReplies((current) => ({
            ...current,
            [signature]: replyMessage ? getReplyPreview(replyMessage) : null,
          }));
        })
        .catch(() => {
          if (isActive) {
            setExternalReplies((current) => ({ ...current, [signature]: null }));
          }
        });
    }

    return () => {
      isActive = false;
    };
  }, [account, messages, replyFetchAvailable, replyLookup]);

  if (!chatAvailable) {
    return (
      <section className="chat-stage" aria-label="Qortal group chat">
        <button className="chat-back-button chat-back-button-empty" type="button" onClick={onBackToDashboard}>
          Dashboard
        </button>
        <div className="chat-empty-state">
          <QubinoMascot className="chat-qubino" mood="confused" />
          <div className="qubino-speech-bubble">
            Home build too old: missing GET_QORTAL_ACTIVE_CHATS or GET_QORTAL_CHAT_MESSAGES.
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="chat-stage" aria-label="Qortal group chat">
      <aside className="chat-sidebar">
        <div className="chat-sidebar-heading">
          <h2>Group Chat</h2>
          <p>Qortal groups</p>
          <button className="chat-back-button" type="button" onClick={onBackToDashboard}>
            Dashboard
          </button>
        </div>
        <div className="chat-account-context">
          <span>This tab uses</span>
          <strong>{boundAccountName}</strong>
          <small title={account.address}>{boundAccountAddress}</small>
        </div>
        {isLoadingGroups ? <p className="chat-loading">Loading groups...</p> : null}
        {!isLoadingGroups && groups.length === 0 ? (
          <div className="chat-group-empty" role="status">
            <strong>No active group chats found for this account.</strong>
            <span>
              ChibiHub keeps the account selected when this app tab opened. To use another Qortal account,
              select it in Home and reopen ChibiHub.
            </span>
          </div>
        ) : null}
        <div className="chat-group-list">
          {groups.map((group) => (
            <button
              className={group.groupId === selectedGroupId ? 'chat-group-item active' : 'chat-group-item'}
              key={group.groupId}
              type="button"
              onClick={() => setSelectedGroupId(group.groupId)}
            >
              <strong>{group.groupName}</strong>
              <span>{group.senderLabel}: {group.lastMessagePreview}</span>
              <small>{group.isOpen === false ? 'Private · ' : ''}{getRelativeTime(group.timestamp)}</small>
            </button>
          ))}
        </div>
      </aside>

      <main className="chat-main">
        <div className="chat-room-heading">
          <div>
            <h2>{selectedGroup?.groupName ?? 'Select a group'}</h2>
            <p>
              {selectedGroup?.isOpen === true
                ? 'Qortal public group messages'
                : selectedGroup?.isOpen === false
                  ? 'Qortal private group messages (encrypted)'
                  : selectedGroup
                    ? 'Qortal group messages'
                    : 'Pick a group to read messages.'}
            </p>
          </div>
          {isLoadingMessages ? (
            <span className="chat-pill">Loading</span>
          ) : (
            <div className="chat-room-actions">
              <span className="chat-pill">
                {!selectedGroup
                  ? 'Select a group'
                  : selectedGroup.isOpen === false
                    ? 'Private · Read-only'
                    : selectedGroup.isOpen == null
                      ? 'Privacy unknown · Read-only'
                      : sendActionAvailable
                        ? 'Send-ready'
                        : 'Read-only'}
              </span>
              <button
                className="chat-refresh-button"
                disabled={isLoadingGroups || isLoadingMessages}
                type="button"
                onClick={requestFullRefresh}
              >
                Refresh
              </button>
            </div>
          )}
        </div>

        {error ? (
          <div className="qubino-speech-bubble chat-error" role="status">
            {error}
          </div>
        ) : null}

        <div className="chat-message-list" ref={feedRef}>
          {messages.map((message, index) => (
            <ChatMessageBubble
              avatarRefreshKey={avatarRefreshKey}
              canOpenLinks={qdnLinksOpenable}
              key={message.signature || `${message.timestamp}-${index}`}
              message={message}
              onOpenLink={handleOpenQdnLink}
              onReply={(replyMessage) => {
                if (!replyMessage.signature) {
                  return;
                }

                setReplyTarget({
                  ...getReplyPreview(replyMessage),
                  signature: replyMessage.signature,
                });
              }}
              qortalIdentity={qortalIdentity}
              replies={replyLookup}
            />
          ))}
        </div>

        <form className="chat-composer" onSubmit={handleSendMessage}>
          <div className="chat-composer-qubino">
            <QubinoMascot action={sendMascotAction} className="chat-qubino-mini" mood={isSending ? 'curious' : 'normal'} />
            {!sendActionAvailable ? (
              <div className="qubino-speech-bubble">Home build too old: missing SEND_QORTAL_GROUP_CHAT.</div>
            ) : selectedGroup?.isOpen === false ? (
              <div className="qubino-speech-bubble">
                Private Qortal group sending stays disabled until Home can encrypt it safely.
              </div>
            ) : selectedGroup?.isOpen == null ? (
              <div className="qubino-speech-bubble">
                Home cannot verify this group's privacy yet, so ChibiHub will not send to it.
              </div>
            ) : sendStatus ? (
              <div className="qubino-speech-bubble" role="status">{sendStatus}</div>
            ) : (
              <div className="qubino-speech-bubble">Qubino can send a Qortal group message for you.</div>
            )}
          </div>

          {replyTarget ? (
            <div className="chat-reply-target">
              <span>Replying to {replyTarget.senderLabel}: {replyTarget.text}</span>
              <button type="button" onClick={() => setReplyTarget(null)}>Cancel</button>
            </div>
          ) : null}

          <div className="chat-composer-row">
            <textarea
              disabled={!selectedGroup || !sendAvailable || isSending}
              onChange={(event) => setDraftMessage(event.target.value)}
              placeholder={selectedGroup ? `Message ${selectedGroup.groupName}` : 'Select a group'}
              rows={3}
              value={draftMessage}
            />
            <button disabled={!selectedGroup || !sendAvailable || isSending || !draftMessage.trim()} type="submit">
              {isSending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </form>
      </main>
    </section>
  );
}
