# photo wall

A self-hosted photo wall built with SvelteKit + SQLite. Drop images in, watch
them play back full-screen on a shuffled slideshow, and manage them through a
paginated gallery.

- **Full-screen slideshow** with seven randomized transitions, keyboard and
  touch navigation, share / favorite / delete from a tap-to-reveal action bar.
- **Drag-and-drop upload** of JPEG / PNG / GIF / WebP / AVIF / BMP / TIFF
  (100 MB per file).
- **Paginated gallery** with single and bulk delete.
- **SQLite** for metadata, raw originals on disk under `storage/images/`.
- **Themable** light / dark (`$lib/theme.svelte.ts`).
- **Port 6300** for both `dev` and `preview`.

## Getting started

```bash
npm install
npm run dev          # http://localhost:6300
```

Other scripts:

```bash
npm run build        # production build (adapter-node)
npm run start        # serve the production build
npm run preview      # vite preview on :6300
npm run check        # svelte-check + TS
npm test             # vitest run
npm run test:watch   # vitest in watch mode
npm run format       # prettier
```

## Configuration

| Env var          | Default                       | Effect                                  |
| ---------------- | ----------------------------- | --------------------------------------- |
| `PHOTO_WALL_DB`  | `./storage/photo_wall.sqlite` | Path to the SQLite database file.       |

Image files always live under `./storage/images/`. Both directories are created
on first boot.

## Project layout

```
src/
├── app.css                        # CSS reset + theme tokens
├── app.html                       # Inline script applies stored/system theme pre-paint
├── lib/
│   ├── components/                # Base UI primitives (Button, Card, Alert, …)
│   ├── server/
│   │   ├── db.ts                  # SQLite handle + image CRUD (createDb factory)
│   │   ├── files.ts               # removeImageFully (DB row + disk file)
│   │   ├── http.ts                # parseId, parsePositiveInt helpers
│   │   └── uploads.ts             # ALLOWED_MIME, MAX_BYTES, validateUpload, safeExt
│   ├── format.ts                  # formatBytes
│   ├── slideshow.ts               # shuffle, step, pickAnimation, buildOrderKeepingCurrent
│   ├── theme.svelte.ts            # Light/dark/system theme runtime
│   ├── layout.svelte.ts           # Drawer/aside layout state
│   ├── types.ts                   # Shared Image type
│   └── index.ts                   # Library re-exports
└── routes/
    ├── +page.svelte               # Full-screen slideshow
    ├── (app)/+layout.svelte       # AppShell + nav
    ├── (app)/gallery/             # Paginated grid + bulk delete
    ├── (app)/upload/              # Drag-and-drop upload
    └── api/
        ├── upload/+server.ts         # POST  /api/upload
        ├── images/+server.ts         # GET   /api/images?page&pageSize
        ├── images/[id]/+server.ts    # GET / DELETE / PATCH (favorite)
        ├── images/[id]/file/+server  # GET   raw image bytes
        └── images/bulk-delete/       # POST  { ids: number[] }
```

## Architecture notes

- **DB factory.** `createDb(path)` opens and migrates a SQLite database and
  returns a handle of prepared statements. The default singleton (used by
  every handler) is built from `PHOTO_WALL_DB`; tests build their own with
  `createDb(':memory:')`.
- **Pure cores.** Validation (`validateUpload`, `safeExt`), formatting
  (`formatBytes`), pagination parsing (`parsePositiveInt`), and the
  shuffle/step logic of the slideshow (`step`, `buildOrderKeepingCurrent`)
  are pure functions in `$lib/` — no FS, no DB, no `Math.random` baked in
  (RNG is injectable). All are covered by unit tests under `tests/`.
- **Side effects at the edges.** API handlers stay thin: parse → call pure
  helpers → talk to the DB → return JSON. The shared `removeImageFully`
  helper is the single place that combines a DB delete with an `unlink` on
  disk.

## Testing

```bash
npm test
```

Tests live in `tests/`:

| File                  | Covers                                                 |
| --------------------- | ------------------------------------------------------ |
| `format.test.ts`      | `formatBytes` edge cases                               |
| `slideshow.test.ts`   | `shuffle`, `pickAnimation`, `step`, order rebuild      |
| `uploads.test.ts`     | `safeExt`, `validateUpload`, `buildStoredFilename`     |
| `http.test.ts`        | `parseId`, `parsePositiveInt`                          |
| `db.test.ts`          | DB factory: insert / get / delete / list / favorite    |
| `api.test.ts`         | Route handler behavior against an in-memory DB         |

`vitest.config.ts` sets `PHOTO_WALL_DB=:memory:` so importing the singleton
during tests never touches the on-disk database.

## Theming

All visual styles reference semantic CSS custom properties in
[`src/app.css`](src/app.css). To add a new theme:

```css
[data-theme='midnight'] {
  --color-bg: #060611;
  --color-surface: #0e0e1c;
  --color-primary: #b67aff;
  /* …override only the tokens you want to change */
}
```

The `$lib/theme.svelte.ts` store handles `light` / `dark` / `system` plus
persistence — extend it if you want to expose more named themes in the UI.

## Layout behavior

| Width        | Nav style                                              |
| ------------ | ------------------------------------------------------ |
| `< 768px`    | Hidden by default; hamburger slides it in over content |
| `>= 768px`   | Always visible; hamburger collapses it to icon-rail    |

`MOBILE_BREAKPOINT` lives in `src/lib/layout.svelte.ts`. The widths
themselves (`--nav-width`, `--nav-width-collapsed`, `--header-height`) are
theme tokens, so you can tune them from CSS without touching the component.

## License

MIT
