let hasPlayedStartupChime = false;

type StartupChimeOptions = {
  replay?: boolean;
};

export async function playStartupChime(options: StartupChimeOptions = {}) {
  if ((hasPlayedStartupChime && !options.replay) || typeof window === 'undefined') {
    return false;
  }

  try {
    const audioWindow = window as Window & {
      webkitAudioContext?: typeof AudioContext;
    };
    const AudioContextConstructor = window.AudioContext ?? audioWindow.webkitAudioContext;

    if (!AudioContextConstructor) {
      return false;
    }

    const context = new AudioContextConstructor();

    if (context.state === 'suspended') {
      await context.resume();
    }

    if (context.state !== 'running') {
      void context.close().catch(() => {});
      return false;
    }

    if (!options.replay) {
      hasPlayedStartupChime = true;
    }

    const now = context.currentTime;
    const gain = context.createGain();

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 3.12);
    gain.connect(context.destination);

    for (const [index, frequency] of [392, 523.25, 659.25, 783.99].entries()) {
      const oscillator = context.createOscillator();
      const toneGain = context.createGain();
      const start = now + 0.08 + index * 0.18;

      oscillator.type = index >= 2 ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);
      toneGain.gain.setValueAtTime(0, start);
      toneGain.gain.linearRampToValueAtTime(0.72, start + 0.05);
      toneGain.gain.exponentialRampToValueAtTime(0.001, start + 0.86);
      oscillator.connect(toneGain);
      toneGain.connect(gain);
      oscillator.start(start);
      oscillator.stop(start + 0.92);
    }

    const finalStart = now + 1.34;

    for (const [index, frequency] of [523.25, 659.25, 783.99, 1046.5].entries()) {
      const oscillator = context.createOscillator();
      const toneGain = context.createGain();

      oscillator.type = index === 3 ? 'sine' : 'triangle';
      oscillator.frequency.setValueAtTime(frequency, finalStart);
      toneGain.gain.setValueAtTime(0, finalStart);
      toneGain.gain.linearRampToValueAtTime(index === 3 ? 0.42 : 0.36, finalStart + 0.08);
      toneGain.gain.exponentialRampToValueAtTime(0.001, finalStart + 1.34);
      oscillator.connect(toneGain);
      toneGain.connect(gain);
      oscillator.start(finalStart);
      oscillator.stop(finalStart + 1.42);
    }

    window.setTimeout(() => {
      void context.close().catch(() => {});
    }, 3400);

    return true;
  } catch {
    // Autoplay and audio context policies vary by host; the intro must never block.
    return false;
  }
}
