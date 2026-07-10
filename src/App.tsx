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
} from './displaySettings';
import { ChatPage } from './ChatPage';
import { Dashboard } from './Dashboard';
import { getEnterIntent, shouldEnterDashboardAfterUnlock } from './entryFlow';
import qubinoTintLogo from './assets/qubino-bw.png';
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

function QubinoLogo({ className }: { className: string }) {
  return <img className={className} src={qubinoTintLogo} alt="ChibiHub Qubino logo" />;
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

export function App() {
  const [bridgeState, setBridgeState] = useState<BridgeState | null>(null);
  const [account, setAccount] = useState<QdnSelectedAccount | null>(null);
  const [isAccountLoading, setIsAccountLoading] = useState(true);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [error, setError] = useState('');
  const [introComplete, setIntroComplete] = useState(() => hasPlayedIntroThisSession || prefersReducedMotion());
  const [soundReplayAvailable, setSoundReplayAvailable] = useState(false);
  const [displaySettings, setDisplaySettings] = useState(getInitialDisplaySettings);
  const [hasEnteredDashboard, setHasEnteredDashboard] = useState(false);
  const [activeView, setActiveView] = useState<AppView>('dashboard');
  const [qortalIdentity, setQortalIdentity] = useState<QortalIdentity | null>(null);
  const [isIdentityLoading, setIsIdentityLoading] = useState(false);

  const accountName = useMemo(() => getQortalIdentityDisplayName(qortalIdentity), [qortalIdentity]);
  const addressLabel = account?.address || 'No address selected';
  const canRequestUnlock = account?.isUnlocked === false && hasAction(bridgeState?.actions, 'UNLOCK_SELECTED_ACCOUNT');
  const runtimeLabel = bridgeState?.isHomeBridge ? 'Home bridge' : 'Browser demo';
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
    let isActive = true;

    setQortalIdentity(null);

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
  }, [account, bridgeState]);

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
        <span className="runtime-chip">{runtimeLabel}</span>
      </header>

      {hasEnteredDashboard && account?.isUnlocked ? (
        activeView === 'chat' ? (
          <ChatPage
            account={account}
            bridgeState={bridgeState}
            onBackToDashboard={() => setActiveView('dashboard')}
            qortalIdentity={qortalIdentity}
          />
        ) : (
          <Dashboard
            account={account}
            bridgeState={bridgeState}
            onOpenChat={() => setActiveView('chat')}
            qortalIdentity={qortalIdentity}
          />
        )
      ) : (
      <section className="entry-stage" aria-labelledby="entry-title">
        <div className="entry-card">
          <div className="card-logo-wrap" aria-hidden="true">
            <QubinoLogo className="card-logo" />
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
