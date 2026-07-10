# ChibiHub

A QDN app for Qortium featuring Qubino, the ChibiHub mascot. Runs inside
[Qortium Home](https://github.com/QortiumDev) as `qdn://APP/ChibiHub/ChibiHub`,
with a read-only browser-development fallback that talks to a local Qortium
Core node and the public Qortal API.

## Features

- Dashboard with Qortium node status and account info
- Qortal group chat reader/sender via the Home QDN bridge
- Inline `qdn://` links in chat messages, opened in a new Home tab (`OPEN_NEW_TAB`)

## Home display styles

ChibiHub follows Qortium Home's display settings on initial render and while the
app is open. Home's `uiStyle=classic` and `uiStyle=modern` values select distinct
Classic and Modern layouts while theme, accent, and text size remain independent.

The original hand-drawn ChibiHub design is preserved as an experimental
`uiStyle=chibi` variant for a possible future Home-wide style. Until Home exposes
that option, it can be previewed directly with `?uiStyle=chibi` on a render or
development URL. Missing or invalid values use the Home contract default,
`classic`.

## Development

```sh
npm install
npm run dev     # Vite dev server with browser fallbacks
npm test        # vitest
npm run build   # typecheck + production build to dist/
```

## Publish to QDN

Publishes `dist/` to a local Qortium Previewnet node as `APP/ChibiHub/ChibiHub`:

```sh
npm run build
npm run qdn:publish
```

The publish script auto-detects the running core's API key and reads the
preview account from `~/qortium/git/qortium-core/preview/`; override paths with
`QORTIUM_CHIBIHUB_*` environment variables (see `scripts/publish-qdn.mjs`).

## License

0BSD
