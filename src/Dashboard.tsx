import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { loadQortalDashboardSnapshot, type QortalDashboardSnapshot } from './dashboardData';
import {
  getQortalIdentityDisplayName,
  getQortalIdentityInitials,
  type QortalIdentity,
} from './qortalIdentity';
import { QubinoMascot, type QubinoAction, type QubinoMood } from './QubinoMascot';
import {
  canLookupQortalTransaction,
  canResolveQortalName,
  canSendQort,
  isQortalAddressShaped,
  isQortalTransactionConfirmed,
  isSendQortCancelled,
  lookupQortalTransaction,
  resolveQortalNameForPreview,
  sendQort,
} from './sendQort';
import type { BridgeState, QdnSelectedAccount } from './types';

export const DASHBOARD_REFRESH_INTERVAL_MS = 30000;
const NAME_RESOLUTION_DEBOUNCE_MS = 450;
const TRANSACTION_POLL_INTERVAL_MS = 10000;
const TRANSACTION_POLL_TIMEOUT_MS = 10 * 60 * 1000;

export function getDashboardRefreshInterval(isSending: boolean) {
  return isSending ? null : DASHBOARD_REFRESH_INTERVAL_MS;
}

const FEATURED_Q_APPS = [
  { label: 'Q-Tube', note: 'Video' },
  { label: 'Quitter', note: 'Social' },
  { label: 'Q-Mail', note: 'Mail' },
  { label: 'Q-Blog', note: 'Posts' },
  { label: 'Q-Trade', note: 'Market' },
  { label: 'SubWire', note: 'Creators' },
] as const;

const EMPTY_SNAPSHOT: QortalDashboardSnapshot = {
  balanceLabel: '—',
  errors: [],
  heightLabel: '—',
  loadedAt: 0,
  nodeModeLabel: 'Qortal node',
  nodeStatusLabel: 'Loading',
  peersLabel: '—',
  qdnPeersLabel: '—',
  statusTone: 'unknown',
};

type RecipientResolutionState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { owner: string; status: 'resolved' }
  | { status: 'not-found' }
  | { message: string; status: 'error' };

type SendTransactionState = 'broadcast' | 'cancelled' | 'confirmed' | 'confirming' | 'failed' | 'idle' | 'pending';

export function getDashboardMascotMood(isLoading: boolean, snapshot: QortalDashboardSnapshot): QubinoMood {
  if (isLoading) {
    return 'worried';
  }

  if (snapshot.statusTone === 'offline' || snapshot.errors.length >= 3) {
    return 'dead';
  }

  if (snapshot.errors.length > 0) {
    return 'confused';
  }

  if (snapshot.statusTone === 'syncing') {
    return 'worried';
  }

  if (snapshot.statusTone === 'unknown') {
    return 'surprised';
  }

  return 'normal';
}

function getDashboardMascotLabel(mood: QubinoMood) {
  switch (mood) {
    case 'confused':
      return 'Checking';
    case 'dead':
      return 'Offline';
    case 'surprised':
      return 'Unknown';
    case 'worried':
      return 'Loading';
    default:
      return 'Watching';
  }
}

function DashboardAvatar({ identity }: { identity: QortalIdentity | null }) {
  const [failed, setFailed] = useState(false);
  const avatarUrl = identity?.avatarUrl;

  useEffect(() => {
    setFailed(false);
  }, [avatarUrl]);

  if (avatarUrl && !failed) {
    return <img className="dashboard-avatar" src={avatarUrl} alt="" onError={() => setFailed(true)} />;
  }

  return <div className="dashboard-avatar dashboard-avatar-fallback">{getQortalIdentityInitials(identity)}</div>;
}

function Panel({
  children,
  className = '',
  eyebrow,
  title,
}: {
  children: ReactNode;
  className?: string;
  eyebrow?: string;
  title: string;
}) {
  return (
    <section className={`dashboard-panel ${className}`.trim()}>
      <div className="dashboard-panel-heading">
        <div>
          <h2>{title}</h2>
          {eyebrow ? <p>{eyebrow}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export function Dashboard({
  account,
  bridgeState,
  onOpenChat,
  qortalIdentity,
}: {
  account: QdnSelectedAccount;
  bridgeState: BridgeState | null;
  onOpenChat: () => void;
  qortalIdentity: QortalIdentity | null;
}) {
  const [snapshot, setSnapshot] = useState<QortalDashboardSnapshot>(EMPTY_SNAPSHOT);
  const [isLoading, setIsLoading] = useState(true);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendMessage, setSendMessage] = useState('');
  const [sendError, setSendError] = useState('');
  const [snapshotRefreshKey, setSnapshotRefreshKey] = useState(0);
  const [recipientResolution, setRecipientResolution] = useState<RecipientResolutionState>({ status: 'idle' });
  const [sendTransactionState, setSendTransactionState] = useState<SendTransactionState>('idle');
  const [pendingSignature, setPendingSignature] = useState('');
  const [mascotAction, setMascotAction] = useState<QubinoAction>('idle');
  const mascotActionTimerRef = useRef<number | null>(null);
  const accountName = useMemo(() => getQortalIdentityDisplayName(qortalIdentity), [qortalIdentity]);
  const mascotMood = getDashboardMascotMood(isLoading, snapshot);
  const sendAvailable = canSendQort(bridgeState);
  const nameResolutionAvailable = canResolveQortalName(bridgeState);
  const transactionLookupAvailable = canLookupQortalTransaction(bridgeState);
  const canSubmitSend = sendAvailable && !isSending && Boolean(recipient.trim()) && Boolean(amount.trim());

  function clearMascotActionTimer() {
    if (mascotActionTimerRef.current != null) {
      window.clearTimeout(mascotActionTimerRef.current);
      mascotActionTimerRef.current = null;
    }
  }

  function scheduleMascotAction(nextAction: QubinoAction, delayMs: number, onlyIfCurrent?: QubinoAction) {
    clearMascotActionTimer();
    mascotActionTimerRef.current = window.setTimeout(() => {
      setMascotAction((current) => (onlyIfCurrent && current !== onlyIfCurrent ? current : nextAction));
      mascotActionTimerRef.current = null;
    }, delayMs);
  }

  useEffect(() => () => clearMascotActionTimer(), []);

  useEffect(() => {
    let isActive = true;

    setIsLoading(true);
    void loadQortalDashboardSnapshot(account, bridgeState)
      .then((nextSnapshot) => {
        if (isActive) {
          setSnapshot(nextSnapshot);
        }
      })
      .catch((error) => {
        if (isActive) {
          setSnapshot({
            ...EMPTY_SNAPSHOT,
            errors: [error instanceof Error ? error.message : String(error)],
            nodeStatusLabel: 'Qortal data unavailable',
          });
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [account, bridgeState, snapshotRefreshKey]);

  useEffect(() => {
    const refreshInterval = getDashboardRefreshInterval(isSending);

    if (refreshInterval == null) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setSnapshotRefreshKey((current) => current + 1);
    }, refreshInterval);

    return () => window.clearInterval(intervalId);
  }, [isSending]);

  useEffect(() => {
    let isActive = true;
    const trimmedRecipient = recipient.trim();

    if (!trimmedRecipient || isQortalAddressShaped(trimmedRecipient) || !nameResolutionAvailable) {
      setRecipientResolution({ status: 'idle' });
      return () => {
        isActive = false;
      };
    }

    setRecipientResolution({ status: 'checking' });

    const timerId = window.setTimeout(() => {
      void resolveQortalNameForPreview(trimmedRecipient)
        .then((nameData) => {
          if (!isActive) {
            return;
          }

          const owner = typeof nameData?.owner === 'string' ? nameData.owner : '';

          setRecipientResolution(owner ? { owner, status: 'resolved' } : { status: 'not-found' });
        })
        .catch((error) => {
          if (isActive) {
            setRecipientResolution({
              message: error instanceof Error ? error.message : String(error),
              status: 'error',
            });
          }
        });
    }, NAME_RESOLUTION_DEBOUNCE_MS);

    return () => {
      isActive = false;
      window.clearTimeout(timerId);
    };
  }, [nameResolutionAvailable, recipient]);

  useEffect(() => {
    if (!pendingSignature) {
      return undefined;
    }

    if (!transactionLookupAvailable) {
      setSendMessage('Broadcast accepted. Home build too old: missing GET_QORTAL_TRANSACTION');
      return undefined;
    }

    let isActive = true;
    const deadline = Date.now() + TRANSACTION_POLL_TIMEOUT_MS;

    async function checkTransaction() {
      try {
        const transaction = await lookupQortalTransaction(pendingSignature);

        if (!isActive) {
          return;
        }

        if (isQortalTransactionConfirmed(transaction)) {
          const height = transaction?.blockHeight ?? transaction?.height;

          setSendTransactionState('confirmed');
          setMascotAction('confirmed');
          scheduleMascotAction('idle', 5000, 'confirmed');
          setSendMessage(`Confirmed in block ${height}. Signature: ${pendingSignature}`);
          setPendingSignature('');
          setSnapshotRefreshKey((current) => current + 1);
          return;
        }

        if (Date.now() >= deadline) {
          setSendTransactionState('broadcast');
          setMascotAction('failed');
          scheduleMascotAction('idle', 5000, 'failed');
          setSendMessage(`Broadcast accepted. Confirmation was not seen after 10 minutes. Signature: ${pendingSignature}`);
          setPendingSignature('');
          return;
        }

        setSendTransactionState('confirming');
        setSendMessage(`Broadcast accepted. Confirming on Qortal... Signature: ${pendingSignature}`);
      } catch (error) {
        if (isActive) {
          setSendTransactionState('failed');
          setMascotAction('failed');
          scheduleMascotAction('idle', 5000, 'failed');
          setSendError(error instanceof Error ? error.message : String(error));
          setPendingSignature('');
        }
      }
    }

    void checkTransaction();
    const intervalId = window.setInterval(checkTransaction, TRANSACTION_POLL_INTERVAL_MS);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, [pendingSignature, transactionLookupAvailable]);

  function renderRecipientResolution() {
    if (recipientResolution.status === 'idle') {
      return null;
    }

    if (recipientResolution.status === 'checking') {
      return <p className="send-qort-resolution">Checking Qortal name...</p>;
    }

    if (recipientResolution.status === 'resolved') {
      return <p className="send-qort-resolution">→ resolves to {recipientResolution.owner}</p>;
    }

    if (recipientResolution.status === 'not-found') {
      return <p className="send-qort-resolution send-qort-resolution-missing">name not found</p>;
    }

    return <p className="send-qort-resolution send-qort-resolution-missing">{recipientResolution.message}</p>;
  }

  async function handleSendQort(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!sendAvailable || isSending) {
      return;
    }

    setIsSending(true);
    setSendError('');
    setSendMessage('');
    setPendingSignature('');
    setSendTransactionState('pending');
    setMascotAction('waiting');
    clearMascotActionTimer();

    try {
      const result = await sendQort(recipient.trim(), amount.trim());

      if (isSendQortCancelled(result)) {
        setSendTransactionState('cancelled');
        setMascotAction('failed');
        scheduleMascotAction('idle', 4000, 'failed');
        setSendMessage('Send cancelled.');
        return;
      }

      if (!result.accepted) {
        setSendTransactionState('failed');
        setMascotAction('failed');
        scheduleMascotAction('idle', 5000, 'failed');
        setSendError(result.error);
        return;
      }

      setSendTransactionState('broadcast');
      setMascotAction('accepted');
      scheduleMascotAction('waiting', 2500, 'accepted');
      setSendMessage(`Broadcast accepted. Signature: ${result.signature}`);
      setPendingSignature(result.signature);
      setAmount('');
      setRecipient('');
      setSnapshotRefreshKey((current) => current + 1);
    } catch (error) {
      setSendTransactionState('failed');
      setMascotAction('failed');
      scheduleMascotAction('idle', 5000, 'failed');
      setSendError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="dashboard-stage" aria-label="Qortal dashboard">
      <div className="dashboard-grid">
        <aside className="qubino-column">
          <Panel className="qubino-panel" title="Qubino">
            <div className="qubino-character-frame" aria-hidden="true">
              <QubinoMascot action={mascotAction} className="qubino-character" mood={mascotMood} />
            </div>
            <p className="qubino-speech-bubble">Qubino is keeping watch over your Qortal dashboard.</p>
            <div className="qubino-status">
              <span className={`status-dot status-${snapshot.statusTone}`} />
              {getDashboardMascotLabel(mascotMood)}
            </div>
          </Panel>

          <Panel className="coming-soon-panel quick-tools-panel" title="Coming Soon" eyebrow="Planned shortcuts">
            <div className="quick-tools" aria-label="Coming soon Qortal quick tools">
              {['Search', 'Wallet', 'Apps', 'Download', 'Garden', 'Mute', 'Add'].map((tool) => (
                <button key={tool} type="button" disabled aria-disabled="true">
                  {tool}
                </button>
              ))}
            </div>
          </Panel>
        </aside>

        <main className="dashboard-main">
          <Panel className="account-overview-panel" title="Account Overview" eyebrow="Qortal name and address">
            <div className="overview-content">
              <DashboardAvatar identity={qortalIdentity} />
              <div className="overview-copy">
                <strong>{accountName}</strong>
                <span className="full-address">{account.address}</span>
              </div>
              <span className="state-pill state-ready">Ready</span>
            </div>
            <div className="dashboard-action-row">
              <button className="primary-action-button" type="button" onClick={onOpenChat}>
                Open Chat
              </button>
            </div>
          </Panel>

          <Panel className="coming-soon-panel" title="Coming Soon" eyebrow="Planned Q-App shortcuts">
            <div className="featured-app-grid">
              {FEATURED_Q_APPS.map((app) => (
                <button className="featured-app-tile" key={app.label} type="button" disabled aria-disabled="true">
                  <span>{app.label}</span>
                  <small>{app.note}</small>
                </button>
              ))}
            </div>
          </Panel>
        </main>

        <aside className="dashboard-rail">
          <Panel className="status-panel" title="Status">
            <dl className="status-list">
              <div>
                <dt>QORT Balance</dt>
                <dd>{isLoading ? 'Loading' : snapshot.balanceLabel}</dd>
              </div>
              <div>
                <dt>{snapshot.nodeModeLabel}</dt>
                <dd>
                  <span className={`sync-pill status-${snapshot.statusTone}`}>{snapshot.nodeStatusLabel}</span>
                </dd>
              </div>
              <div>
                <dt>Block Height</dt>
                <dd>{snapshot.heightLabel}</dd>
              </div>
            </dl>
            <div className="metric-grid">
              <div>
                <span>Peers</span>
                <strong>{snapshot.peersLabel}</strong>
              </div>
              <div>
                <span>QDN</span>
                <strong>{snapshot.qdnPeersLabel}</strong>
              </div>
            </div>
          </Panel>

          <Panel title="Wallet Activity">
            <form className="send-qort-card" onSubmit={handleSendQort}>
              <div className="send-qort-heading">
                <strong>Send QORT</strong>
                <span>{sendAvailable ? 'Local signing' : 'Unavailable'}</span>
              </div>
              {!sendAvailable ? (
                <p className="send-qort-note">Home build too old: missing SEND_QORT</p>
              ) : null}
              <label>
                <span>Recipient</span>
                <input
                  value={recipient}
                  disabled={!sendAvailable || isSending}
                  placeholder="Q..."
                  autoComplete="off"
                  onChange={(event) => setRecipient(event.target.value)}
                />
                {renderRecipientResolution()}
              </label>
              <label>
                <span>Amount</span>
                <input
                  value={amount}
                  disabled={!sendAvailable || isSending}
                  placeholder="0.00"
                  inputMode="decimal"
                  autoComplete="off"
                  onChange={(event) => setAmount(event.target.value)}
                />
              </label>
              <button type="submit" disabled={!canSubmitSend}>
                {isSending ? 'Waiting for Home' : 'Send QORT'}
              </button>
              {sendTransactionState !== 'idle' ? (
                <p className={`send-qort-state send-qort-state-${sendTransactionState}`}>
                  {sendTransactionState === 'pending'
                    ? 'Waiting for Home approval'
                    : sendTransactionState === 'broadcast'
                      ? 'Broadcast'
                      : sendTransactionState === 'confirming'
                        ? 'Confirming'
                        : sendTransactionState === 'confirmed'
                          ? 'Confirmed'
                          : sendTransactionState === 'cancelled'
                            ? 'Cancelled'
                            : 'Needs attention'}
                </p>
              ) : null}
              {sendMessage ? <p className="send-qort-message">{sendMessage}</p> : null}
              {sendError ? <p className="send-qort-error">{sendError}</p> : null}
            </form>
          </Panel>
        </aside>

        <Panel className="wide-panel group-panel coming-soon-panel" title="Coming Soon" eyebrow="Group Activity">
          <div className="placeholder-row">
            <strong>Qortal group activity</strong>
            <span>Planned dashboard summary.</span>
          </div>
        </Panel>

        <Panel className="wide-panel feed-panel coming-soon-panel" title="Coming Soon" eyebrow="Quitter Feed">
          <div className="placeholder-row">
            <strong>Quitter feed</strong>
            <span>Planned feed preview.</span>
          </div>
        </Panel>
      </div>

      {snapshot.errors.length ? (
        <div className="dashboard-data-note" role="status">
          Qortal live data is partially unavailable. Placeholder values are shown.
        </div>
      ) : null}
    </section>
  );
}
