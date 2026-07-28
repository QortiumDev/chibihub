import { version as reactVersion } from 'react';
import { version as reactDomVersion } from 'react-dom';
import { describe, expect, it } from 'vitest';

/**
 * React 19 refuses to render when `react` and `react-dom` resolve to different
 * versions: it throws "Minified React error #527" at mount and the app shows a
 * blank page. Nothing else in this suite catches that — the unit tests never
 * mount through react-dom, and both `tsc` and `vite build` succeed.
 *
 * It happened for real: a Dependabot bump moved `react` to 19.2.8 while
 * `react-dom` stayed on 19.2.7, and the published app rendered nothing. These
 * are the versions the bundle actually resolves, not the declared ranges.
 */
describe('react and react-dom stay on the same version', () => {
  it('resolves both packages to one version', () => {
    expect(reactVersion).toBeTruthy();
    expect(reactDomVersion).toBe(reactVersion);
  });
});
