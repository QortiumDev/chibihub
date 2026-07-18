import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  hasAction,
  isSelectedAccountChangedMessage,
  loadSelectedAccount,
  unlockSelectedAccount,
} from './account';
import {
  applyDisplaySettings,
  getDisplaySettingsUpdateFromMessage,
  getInitialDisplaySettings,
  type QdnDisplaySettings,
} from './displaySettings';
import {
  CHECKING_ACCOUNT_BLOCK_STATUS,
  getAccountBlockMascotMood,
  getAccountBlockStatusLabel,
  loadAccountBlockStatus,
  type AccountBlockStatus,
} from './accountBlockStatus';
import { ChatPage } from './ChatPage';
import { Dashboard } from './Dashboard';
import { QubinoMascot } from './QubinoMascot';
import { getEnterIntent, shouldEnterDashboardAfterUnlock } from './entryFlow';
import qubinoTintLogo from './assets/qubino-bw.png';
import { loadQortalNodeContext, type QortalNodeContext } from './nodeContext';
import { getBridgeState } from './qdnRequest';
import {
  getQortalIdentityDisplayName,
  getQortalIdentityInitials,
  loadQortalIdentity,
  type QortalIdentity,
} from './qortalIdentity';
import { playStartupChime } from './startupSound';
import type { BridgeState, QdnSelectedAccount } from './types';

const APP_TITLE = 'ChibiHub';
const INTRO_DURATION_MS = 3400;

let hasPlayedIntroThisSession = false;

type AppView = 'chat' | 'dashboard';

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function QubinoLogo({ blocked, className }: { blocked: boolean; className: string }) {
  return <QubinoMascot className={className} idleAfterMs={0} mood={blocked ? 'dead' : 'normal'} />;
}

function QubinoMark({ className }: { className: string }) {
  return <img className={className} src={qubinoTintLogo} alt="" />;
}

function QubinoTintMark({ className }: { className: string }) {
  return <img className={className} src={qubinoTintLogo} alt="" />;
}

function AccountAvatar({ identity }: { identity: QortalIdentity | null }) {
  const [failed, setFailed] = useState(false);
  const avatarUrl = identity?.avatarUrl;

  useEffect(() => {
    setFailed(false);
  }, [avatarUrl]);

  if (avatarUrl && !failed) {
    return <img className="account-avatar" src={avatarUrl} alt="" onError={() => setFailed(true)} />;
  }

  return <div className="account-avatar account-avatar-fallback">{getQortalIdentityInitials(identity)}</div>;
}

type AppProps = {
  initialDisplaySettings?: QdnDisplaySettings;
};

export function App({ initialDisplaySettings }: AppProps = {}) {
  const [bridgeState, setBridgeState] = useState<BridgeState | null>(null);
  const [account, setAccount] = useState<QdnSelectedAccount | null>(null);
  const [isAccountLoading, setIsAccountLoading] = useState(true);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [error, setError] = useState('');
  const [introComplete, setIntroComplete] = useState(() => hasPlayedIntroThisSession || prefersReducedMotion());
  const [soundReplayAvailable, setSoundReplayAvailable] = useState(false);
  const [displaySettings, setDisplaySettings] = useState(
    () => initialDisplaySettings ?? getInitialDisplaySettings(),
  );
  const [hasEnteredDashboard, setHasEnteredDashboard] = useState(false);
  const [activeView, setActiveView] = useState<AppView>('dashboard');
  const [qortalIdentity, setQortalIdentity] = useState<QortalIdentity | null>(null);
  const [isIdentityLoading, setIsIdentityLoading] = useState(false);
  const [identityRefreshKey, setIdentityRefreshKey] = useState(0);
  const [accountBlockStatus, setAccountBlockStatus] = useState<AccountBlockStatus>(
    CHECKING_ACCOUNT_BLOCK_STATUS,
  );
  const [qortalNodeContext, setQortalNodeContext] = useState<QortalNodeContext | null>(null);
  const [qortalNodeError, setQortalNodeError] = useState('');

  const accountName = useMemo(() => getQortalIdentityDisplayName(qortalIdentity), [qortalIdentity]);
  const addressLabel = account?.address || 'No address selected';
  const canRequestUnlock = account?.isUnlocked === false && hasAction(bridgeState?.actions, 'UNLOCK_SELECTED_ACCOUNT');
  const runtimeLabel = bridgeState?.isHomeBridge ? 'Home bridge' : 'Browser demo';
  const nodeSourceLabel = qortalNodeContext?.label ?? (qortalNodeError ? 'Qortal node source unavailable' : 'Checking Qortal node');
  const enterIntent = getEnterIntent({
    account,
    canRequestUnlock,
    isAccountLoading,
    isUnlocking,
  });

  const refreshAccount = useCallback(async () => {
    setIsAccountLoading(true);
    setError('');

    try {
      const [state, selectedAccount] = await Promise.all([getBridgeState(), loadSelectedAccount()]);

      setBridgeState(state);
      setAccount(selectedAccount);

      if (!selectedAccount?.isUnlocked) {
        setHasEnteredDashboard(false);
        setActiveView('dashboard');
      }
    } catch (refreshError) {
      setAccount(null);
      setHasEnteredDashboard(false);
      setActiveView('dashboard');
      setError(refreshError instanceof Error ? refreshError.message : String(refreshError));
    } finally {
      setIsAccountLoading(false);
    }
  }, []);

  useEffect(() => {
    setQortalIdentity(null);
  }, [account?.address]);

  useEffect(() => {
    let isActive = true;

    if (!account) {
      setIsIdentityLoading(false);
      return () => {
        isActive = false;
      };
    }

    setIsIdentityLoading(true);
    void loadQortalIdentity(account, bridgeState)
      .then((identity) => {
        if (isActive) {
          setQortalIdentity(identity);
        }
      })
      .finally(() => {
        if (isActive) {
          setIsIdentityLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [account, bridgeState, identityRefreshKey]);

  useEffect(() => {
    let isActive = true;

    if (!bridgeState) {
      setQortalNodeContext(null);
      setQortalNodeError('');
      return () => {
        isActive = false;
      };
    }

    setQortalNodeContext(null);
    setQortalNodeError('');
    void loadQortalNodeContext(bridgeState)
      .then((context) => {
        if (isActive) {
          setQortalNodeContext(context);
        }
      })
      .catch((nodeError) => {
        if (isActive) {
          setQortalNodeError(nodeError instanceof Error ? nodeError.message : String(nodeError));
        }
      });

    return () => {
      isActive = false;
    };
  }, [bridgeState]);

  useEffect(() => {
    let isActive = true;

    if (!account || isIdentityLoading || (!qortalNodeContext && !qortalNodeError)) {
      setAccountBlockStatus(CHECKING_ACCOUNT_BLOCK_STATUS);
      return () => {
        isActive = false;
      };
    }

    setAccountBlockStatus(CHECKING_ACCOUNT_BLOCK_STATUS);
    void loadAccountBlockStatus(account, qortalIdentity?.name ?? null, qortalNodeContext).then((status) => {
      if (isActive) {
        setAccountBlockStatus(status);
      }
    });

    return () => {
      isActive = false;
    };
  }, [account, isIdentityLoading, qortalIdentity?.name, qortalNodeContext, qortalNodeError]);

  useEffect(() => {
    void refreshAccount();
  }, [refreshAccount]);

  useEffect(() => {
    applyDisplaySettings(displaySettings);
  }, [displaySettings]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.source !== window.parent) {
        return;
      }

      setDisplaySettings((current) => getDisplaySettingsUpdateFromMessage(event.data, current) ?? current);

      if (isSelectedAccountChangedMessage(event.data)) {
        void refreshAccount();
      }
    }

    window.addEventListener('message', handleMessage);

    return () => window.removeEventListener('message', handleMessage);
  }, [refreshAccount]);

  useEffect(() => {
    if (introComplete) {
      hasPlayedIntroThisSession = true;
      return undefined;
    }

    if (prefersReducedMotion()) {
      setIntroComplete(true);
      hasPlayedIntroThisSession = true;
      return undefined;
    }

    hasPlayedIntroThisSession = true;
    void playStartupChime().then((played) => {
      if (!played) {
        setSoundReplayAvailable(true);
      }
    });

    const timer = window.setTimeout(() => setIntroComplete(true), INTRO_DURATION_MS);

    return () => window.clearTimeout(timer);
  }, [introComplete]);

  async function handleUnlock() {
    setIsUnlocking(true);
    setError('');

    try {
      const unlockedAccount = await unlockSelectedAccount();

      setAccount(unlockedAccount);

      if (shouldEnterDashboardAfterUnlock(unlockedAccount)) {
        setHasEnteredDashboard(true);
      }
    } catch (unlockError) {
      setError(unlockError instanceof Error ? unlockError.message : String(unlockError));
    } finally {
      setIsUnlocking(false);
    }
  }

  async function handleEnterQortal() {
    if (enterIntent === 'enter-dashboard') {
      setHasEnteredDashboard(true);
      return;
    }

    if (enterIntent === 'unlock-account') {
      setIsUnlocking(true);
      setError('');

      try {
        const unlockedAccount = await unlockSelectedAccount();

        setAccount(unlockedAccount);

        if (shouldEnterDashboardAfterUnlock(unlockedAccount)) {
          setHasEnteredDashboard(true);
        } else {
          setError('Unlock did not complete. Try again from Qortium Home.');
        }
      } catch (unlockError) {
        setError(unlockError instanceof Error ? unlockError.message : String(unlockError));
      } finally {
        setIsUnlocking(false);
      }

      return;
    }

    if (enterIntent === 'blocked') {
      setError(account ? 'Unlock is not available in this Home context.' : 'No Home account selected.');
    }
  }

  async function handleReplaySound() {
    const played = await playStartupChime({ replay: true });

    if (played) {
      setSoundReplayAvailable(false);
    }
  }

  return (
    <main
      className={`chibi-app ${introComplete ? 'intro-complete' : 'intro-running'} ${
        hasEnteredDashboard && account?.isUnlocked && activeView === 'chat' ? 'chat-active' : ''
      }`}
      data-accent={displaySettings.accent}
      data-text-size={displaySettings.textSize}
      data-theme={displaySettings.theme}
      data-ui={displaySettings.uiStyle}
    >
      {!introComplete ? (
        <div className="intro-overlay" aria-hidden="true">
          <QubinoTintMark className="intro-logo-travel" />
        </div>
      ) : null}

      {soundReplayAvailable ? (
        <button className="sound-replay-button" type="button" onClick={handleReplaySound}>
          Play sound
        </button>
      ) : null}

      <header className="app-topbar">
        <div className="brand-lockup">
          <QubinoMark className="brand-mark" />
          <span>{APP_TITLE}</span>
        </div>
        <span className="runtime-chip">{runtimeLabel} · {nodeSourceLabel} · {__APP_VERSION__}</span>
      </header>

      {hasEnteredDashboard && account?.isUnlocked ? (
        activeView === 'chat' ? (
          <ChatPage
            account={account}
            bridgeState={bridgeState}
            onBackToDashboard={() => setActiveView('dashboard')}
            onRefreshIdentity={() => setIdentityRefreshKey((current) => current + 1)}
            qortalIdentity={qortalIdentity}
          />
        ) : (
          <Dashboard
            account={account}
            accountBlockStatus={accountBlockStatus}
            bridgeState={bridgeState}
            onOpenChat={() => setActiveView('chat')}
            qortalIdentity={qortalIdentity}
            qortalNodeContext={qortalNodeContext}
            qortalNodeError={qortalNodeError}
          />
        )
      ) : (
      <section className="entry-stage" aria-labelledby="entry-title">
        <div className="entry-card">
          <div className="card-logo-wrap" aria-hidden="true">
            <QubinoLogo blocked={getAccountBlockMascotMood(accountBlockStatus) === 'dead'} className="card-logo" />
          </div>

          <div className="entry-heading reveal reveal-one">
            <p className="eyebrow">Tiny gateway</p>
            <h1 id="entry-title">Enter Qortal</h1>
            <p>Access the selected Qortal account.</p>
          </div>

          <div className="account-panel reveal reveal-two">
            {isAccountLoading ? (
              <div className="account-loading">Finding selected account...</div>
            ) : account ? (
              <div className="account-row">
                <AccountAvatar identity={qortalIdentity} />
                <div className="account-copy">
                  <div className="account-name-line">
                    <strong>{isIdentityLoading ? 'Selected account' : accountName}</strong>
                    <span className={account.isUnlocked ? 'state-pill state-ready' : 'state-pill state-locked'}>
                      {account.isUnlocked ? 'Ready' : 'Locked'}
                    </span>
                  </div>
                  <span className="full-address">{addressLabel}</span>
                </div>
                {canRequestUnlock ? (
                  <button className="unlock-button" type="button" onClick={handleUnlock} disabled={isUnlocking}>
                    {isUnlocking ? 'Unlocking' : 'Unlock'}
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="account-loading">No Home account selected.</div>
            )}
          </div>

          <div className="entry-node-status reveal reveal-two">
            <div>
              <span>Qortal data source</span>
              <strong>{nodeSourceLabel}</strong>
              <small>{qortalNodeContext?.origin ?? qortalNodeError}</small>
            </div>
            {account ? (
              <div
                className={`account-block-state account-block-state-${accountBlockStatus.state}`}
                role={accountBlockStatus.state === 'blocked' ? 'alert' : 'status'}
              >
                <span>Chat block check</span>
                <strong>{getAccountBlockStatusLabel(accountBlockStatus)}</strong>
                <small>{accountBlockStatus.detail}</small>
              </div>
            ) : null}
          </div>

          {error ? (
            <div className="notice reveal reveal-two" role="status">
              {error}
            </div>
          ) : null}

          <button
            className={`enter-button reveal reveal-three ${
              enterIntent !== 'enter-dashboard' ? 'enter-button-soft-disabled' : ''
            }`.trim()}
            type="button"
            aria-disabled={enterIntent !== 'enter-dashboard'}
            disabled={enterIntent === 'wait'}
            onClick={handleEnterQortal}
          >
            {isUnlocking ? 'Unlocking' : 'Enter Qortal'}
          </button>
        </div>
      </section>
      )}
    </main>
  );
}
