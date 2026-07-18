# ChibiHub

A QDN app for Qortium featuring Qubino, the ChibiHub mascot. Runs inside
[Qortium Home](https://github.com/QortiumDev/qortium-home) as `qdn://APP/ChibiHub/ChibiHub`,
with a read-only browser-development fallback that talks to a local Qortium
Core node and the public Qortal API.

## Features

- Dashboard with Qortium node status and account info
- Qortal group chat reader and public-group sender via Qortium Home's QDN
  bridge. The browser fallback reads the same network from the public Qortal
  API.
- Account-bound chat context, explicit public/private group state, and guarded
  read-only handling when Home cannot verify that a group is public
- Inline `qdn://` links in chat messages, opened in a new Home tab (`OPEN_NEW_TAB`)

## Home display styles

ChibiHub follows Qortium Home's display settings on initial render and while the
app is open. Home's `uiStyle=classic`, `uiStyle=modern`, and `uiStyle=fun` values
select distinct Classic, Modern, and Fun layouts while theme, accent, and text
size remain independent. Fun is ChibiHub's original hand-drawn design, now
shared as a Home-wide style. Missing or invalid values use the Home contract
default, `classic`.

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

## Versioning

ChibiHub has not yet adopted the Qortium app versioning standard (QAVS) — `package.json` is still 0.1.0 and the build does not emit a `qortium-app.json` manifest — and will adopt it at its next republish.

## License

0BSD
