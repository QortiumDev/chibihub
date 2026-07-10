import { describe, expect, it } from 'vitest';
import { getMascotLookOffset, resolveMascotActionMood, resolveMascotImageMood } from './QubinoMascot';

const rect = {
  height: 100,
  left: 10,
  top: 20,
  width: 100,
};

describe('Qubino mascot pointer tracking', () => {
  it('centers the look offset when the pointer is centered', () => {
    expect(getMascotLookOffset(rect, 60, 70)).toEqual({ rotate: 0, x: 0, y: 0 });
  });

  it('tracks the pointer within the configured limit', () => {
    expect(getMascotLookOffset(rect, 110, 120)).toEqual({ rotate: 3.5, x: 8, y: 8 });
    expect(getMascotLookOffset(rect, 10, 20)).toEqual({ rotate: -3.5, x: -8, y: -8 });
  });

  it('clamps far outside pointer positions', () => {
    expect(getMascotLookOffset(rect, 500, -500)).toEqual({ rotate: 3.5, x: 8, y: -8 });
  });
});

describe('Qubino mascot moods', () => {
  it('uses the requested mood when there is no interaction', () => {
    expect(resolveMascotImageMood({ isHovered: false, isIdle: false, isPressed: false, mood: 'worried' })).toBe(
      'worried',
    );
  });

  it('uses curious for neutral hover and focus states', () => {
    expect(resolveMascotImageMood({ isHovered: true, isIdle: false, isPressed: false, mood: 'normal' })).toBe(
      'curious',
    );
    expect(resolveMascotImageMood({ isHovered: true, isIdle: false, isPressed: false, mood: 'sleeping' })).toBe(
      'curious',
    );
  });

  it('uses sleeping after neutral idle timeout', () => {
    expect(resolveMascotImageMood({ isHovered: false, isIdle: true, isPressed: false, mood: 'normal' })).toBe(
      'sleeping',
    );
  });

  it('uses stronger feedback while pressed', () => {
    expect(resolveMascotImageMood({ isHovered: true, isIdle: false, isPressed: true, mood: 'normal' })).toBe(
      'squinting',
    );
    expect(resolveMascotImageMood({ isHovered: true, isIdle: false, isPressed: true, mood: 'confused' })).toBe(
      'angry',
    );
    expect(resolveMascotImageMood({ isHovered: true, isIdle: false, isPressed: true, mood: 'dead' })).toBe('dead');
  });

  it('maps send actions to distinct mascot moods', () => {
    expect(resolveMascotActionMood('normal', 'waiting')).toBe('curious');
    expect(resolveMascotActionMood('normal', 'accepted')).toBe('surprised');
    expect(resolveMascotActionMood('normal', 'confirmed')).toBe('derp');
    expect(resolveMascotActionMood('normal', 'failed')).toBe('confused');
    expect(resolveMascotActionMood('worried', 'idle')).toBe('worried');
  });
});
