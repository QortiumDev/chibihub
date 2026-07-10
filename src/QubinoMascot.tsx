import { useEffect, useState, type CSSProperties, type FocusEvent, type PointerEvent } from 'react';
import qubinoAngry from './assets/qubino-bw-angry.png';
import qubinoConfused from './assets/qubino-bw-confused.png';
import qubinoCurious from './assets/qubino-bw-curious.png';
import qubinoDead from './assets/qubino-bw-dead.png';
import qubinoDerp from './assets/qubino-bw-derp.png';
import qubinoNormal from './assets/qubino-bw.png';
import qubinoPressed from './assets/qubino-bw2.png';
import qubinoSleeping from './assets/qubino-bw-sleeping.png';
import qubinoSurprised from './assets/qubino-bw-surprised.png';
import qubinoWorried from './assets/qubino-bw-worried.png';

export type QubinoMood =
  | 'angry'
  | 'confused'
  | 'curious'
  | 'dead'
  | 'derp'
  | 'normal'
  | 'sleeping'
  | 'surprised'
  | 'worried';

export type QubinoImageMood = QubinoMood | 'squinting';
export type QubinoAction = 'accepted' | 'confirmed' | 'failed' | 'idle' | 'waiting';

const QUBINO_IMAGES: Record<QubinoImageMood, string> = {
  angry: qubinoAngry,
  confused: qubinoConfused,
  curious: qubinoCurious,
  dead: qubinoDead,
  derp: qubinoDerp,
  normal: qubinoNormal,
  sleeping: qubinoSleeping,
  squinting: qubinoPressed,
  surprised: qubinoSurprised,
  worried: qubinoWorried,
};

export type MascotLookOffset = {
  rotate: number;
  x: number;
  y: number;
};

export type MascotMoodState = {
  isHovered: boolean;
  isIdle: boolean;
  isPressed: boolean;
  mood: QubinoMood;
};

export function getMascotLookOffset(
  rect: Pick<DOMRect, 'height' | 'left' | 'top' | 'width'>,
  pointerX: number,
  pointerY: number,
  limit = 8,
): MascotLookOffset {
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const normalizedX = rect.width > 0 ? (pointerX - centerX) / (rect.width / 2) : 0;
  const normalizedY = rect.height > 0 ? (pointerY - centerY) / (rect.height / 2) : 0;
  const clampedX = Math.max(-1, Math.min(1, normalizedX));
  const clampedY = Math.max(-1, Math.min(1, normalizedY));

  return {
    rotate: Number((clampedX * 3.5).toFixed(2)),
    x: Number((clampedX * limit).toFixed(2)),
    y: Number((clampedY * limit).toFixed(2)),
  };
}

export function resolveMascotImageMood({ isHovered, isIdle, isPressed, mood }: MascotMoodState): QubinoImageMood {
  if (isPressed) {
    return mood === 'worried' || mood === 'confused' ? 'angry' : mood === 'dead' ? 'dead' : 'squinting';
  }

  if (isHovered) {
    return mood === 'normal' || mood === 'derp' || mood === 'sleeping' ? 'curious' : mood;
  }

  if (isIdle && mood === 'normal') {
    return 'sleeping';
  }

  return mood;
}

export function resolveMascotActionMood(mood: QubinoMood, action: QubinoAction = 'idle'): QubinoMood {
  switch (action) {
    case 'waiting':
      return 'curious';
    case 'accepted':
      return 'surprised';
    case 'confirmed':
      return 'derp';
    case 'failed':
      return 'confused';
    default:
      return mood;
  }
}

export function QubinoMascot({
  action = 'idle',
  className = '',
  idleAfterMs = 30000,
  mood = 'normal',
}: {
  action?: QubinoAction;
  className?: string;
  idleAfterMs?: number;
  mood?: QubinoMood;
}) {
  const [activityCount, setActivityCount] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isIdle, setIsIdle] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [lookOffset, setLookOffset] = useState<MascotLookOffset>({ rotate: 0, x: 0, y: 0 });
  const actionMood = resolveMascotActionMood(mood, action);
  const activeMood = resolveMascotImageMood({ isHovered, isIdle, isPressed, mood: actionMood });

  useEffect(() => {
    setIsIdle(false);

    if (action !== 'idle' || mood !== 'normal' || isHovered || isPressed || idleAfterMs <= 0) {
      return undefined;
    }

    const idleTimer = window.setTimeout(() => setIsIdle(true), idleAfterMs);

    return () => window.clearTimeout(idleTimer);
  }, [action, activityCount, idleAfterMs, isHovered, isPressed, mood]);

  function noteActivity() {
    setIsIdle(false);
    setActivityCount((currentValue) => currentValue + 1);
  }

  function handlePointerMove(event: PointerEvent<HTMLImageElement>) {
    setLookOffset(getMascotLookOffset(event.currentTarget.getBoundingClientRect(), event.clientX, event.clientY));
  }

  function handlePointerEnter() {
    noteActivity();
    setIsHovered(true);
  }

  function handlePointerDown(event: PointerEvent<HTMLImageElement>) {
    noteActivity();
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsPressed(true);
    handlePointerMove(event);
  }

  function handlePointerUp(event: PointerEvent<HTMLImageElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    noteActivity();
    setIsPressed(false);
  }

  function handleFocus(_event: FocusEvent<HTMLImageElement>) {
    noteActivity();
    setIsHovered(true);
  }

  function handleBlur() {
    resetMascot();
  }

  function resetMascot() {
    noteActivity();
    setIsHovered(false);
    setIsPressed(false);
    setLookOffset({ rotate: 0, x: 0, y: 0 });
  }

  return (
    <img
      className={`${className} qubino-mascot ${isPressed ? 'qubino-mascot-pressed' : ''}`.trim()}
      src={QUBINO_IMAGES[activeMood]}
      alt=""
      aria-hidden="true"
      data-qubino-mood={activeMood}
      data-qubino-action={action}
      draggable={false}
      onBlur={handleBlur}
      onFocus={handleFocus}
      onPointerCancel={resetMascot}
      onPointerDown={handlePointerDown}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={resetMascot}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={
        {
          '--qubino-look-rotate': `${lookOffset.rotate}deg`,
          '--qubino-look-x': `${lookOffset.x}px`,
          '--qubino-look-y': `${lookOffset.y}px`,
        } as CSSProperties
      }
    />
  );
}
