# CLAUDE.md — Jokenia Operations Desktop
> Also load CLAUDE_OPS.md at every session start — ops bridge and dispatch protocol.
> Load JOKENIA_GLOBAL.md (via the ops context_documents table) before this file — shared business rules and conventions across all Jokenia components.

Electron desktop app for Jokenia Designs, used at the physical shop register.
**Electron · electron-vite · React 18 · TypeScript (strict) · Tailwind · Supabase**

---

## 1. App Overview

- **Version:** 1.0.0
- **Purpose:** Point-of-sale and back-office desktop app for the Jokenia Designs shop. Mirrors the Jokenia Operations (Admin) mobile app's functionality — staff, batches, inventory, consignees, sales, services, reconciliation, expenses — excluding analytics. Adds functionality the mobile app cannot: barcode scanner checkout, label printing, and (planned) admin account management.
- **Hardware target:** Windows 10 Pro 22H2 · Intel Core i5-6300U @ 2.40GHz · 8GB RAM · 238GB storage. Single admin user, one session all day — no fast user switching. Optimization is a first-class constraint; avoid heavy dependencies where a lighter alternative exists.
- **Relationship to admin app:** Shares the same Supabase backend (project `oiyazguuiqjyrljraodd`) as Jokenia Operations (Admin) and Jokenia Production (Staff) mobile apps. Independently versioned — never conflate release cycles.

---

## 2. EAS Equivalent

The mobile apps use EAS Build + EAS Update for native builds and JS-layer OTA. This app has no EAS project — the desktop equivalent is:

| Mobile (EAS) | Desktop (this app) |
|---|---|
| EAS Build | `electron-builder` — produces the NSIS installer (`.exe`) |
| EAS Update (OTA) | `electron-updater` — checks GitHub Releases on boot, downloads and installs updates silently |
| Firebase App Distribution | GitHub Releases (`publish.provider: github`, private repo) |
| `appVersion` runtime policy | `electron-updater`'s own version comparison against the published release |

No build credits system — GitHub Releases hosting is free for a private repo at this scale.

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Shell | Electron ^39 |
| Build tool | electron-vite (wraps Vite for main + preload + renderer) |
| UI framework | React 18 + TypeScript (strict) |
| Styling | Tailwind CSS 3 |
| Routing | react-router-dom v6 (`HashRouter` — required for `file://` production loads) |
| Server state | @tanstack/react-query v5 |
| UI state | zustand (cart, active tab, sale type, payment method, online status) |
| Backend client | @supabase/supabase-js |
| App preferences | electron-store (NOT used for Supabase session — that's handled by supabase-js's own storage) |
| Packaging | electron-builder |
| OTA updates | electron-updater via GitHub Releases |
| Path alias | `@/*` → `src/renderer/src/*` (matches admin app's `@/*` → `src/*` convention) |
| Fonts | DM Sans (body/UI) + Syne (headings), loaded via Google Fonts CDN in `src/renderer/index.html` |

---

## 4. Project Structure

```
src/
  main/
    index.ts                       Electron main process — window creation, IPC handlers
                                    (print-label, app-get-version, check-for-updates,
                                    preferences-get/set), electron-updater wiring
  preload/
    index.ts                       contextBridge — merges @electron-toolkit electronAPI
                                    with print()/getVersion()/checkForUpdates()/
                                    getPreference()/setPreference() onto window.electron
    index.d.ts                     Window.electron type augmentation
  renderer/
    index.html                     Renderer HTML entry — Google Fonts link, CSP
    src/
      App.tsx                      Layout C shell: TopBar + Register + router outlet
      main.tsx                     React entry — QueryClientProvider + HashRouter
      lib/
        supabase.ts                Supabase client (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
      store/
        appStore.ts                Zustand store: cart[], activeTab, saleType,
                                    paymentMethod, isOnline
      components/
        layout/
          TopBar.tsx                Top bar — wordmark, TabNav, connectivity dot, avatar
          TabNav.tsx                Tab strip — active tab styling, batch badge count
        register/
          Register.tsx              Always-visible left register panel
          ScanInput.tsx              Auto-focused scan input, global keyboard capture
          CartItem.tsx               Single cart row
        ui/
          Button.tsx, Badge.tsx, Modal.tsx   Shared primitives
          PagePlaceholder.tsx        Centered placeholder text, used by all stub pages
      pages/
        CheckoutPage.tsx, InventoryPage.tsx, BatchesPage.tsx, StaffPage.tsx,
        ConsigneesPage.tsx, PartnersPage.tsx, ServicesPage.tsx,
        ReconciliationPage.tsx, ExpensesPage.tsx, SettingsPage.tsx
      types/
        index.ts                   TabId, SaleType, PaymentMethod, ItemStatus, CartItem

resources/
  icon.png                         512x512 app icon (electron-builder buildResources)

Root:
  electron.vite.config.ts          main/preload/renderer build config, @ alias
  electron-builder.yml             Packaging config — see below
  tailwind.config.js               Jokenia brand palette tokens
  postcss.config.js
  tsconfig.json / tsconfig.node.json / tsconfig.web.json
  .env.example                     VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
```

---

## 5. Layout Architecture — Layout C (locked)

Three-zone persistent layout. **All zones visible at all times**, regardless of active tab.

**Zone 1 — Top bar** (~44px, `bg-jokenia-dark`)
Left: JOKENIA wordmark (Syne, `jokenia-gold`). Centre: tab strip (Checkout · Inventory · Batches · Staff · Consignees · Partners · Services · Reconciliation · Expenses · Settings) — active tab gets gold text + 2.5px bottom border; Batches shows a badge count when pending batches exist. Right: connectivity dot (green = online), admin avatar circle, settings icon.

**Zone 2 — Register panel** (278px fixed width, `bg-jokenia-cream`)
Always visible regardless of active tab. Sale type pills (Retail / Wholesale / Manual) → scan input (auto-focused, global keyboard capture) → scrollable cart list → payment method pills (Cash / M-Pesa / Card) → total (Syne, large) → Confirm Sale button (gold, full width) → Void cart / Print label row.

**Zone 3 — Content pane** (`flex: 1`, `bg-jokenia-cream2`)
Renders the active tab's page component via the router outlet.

---

## 6. Architecture Principles

Same authority hierarchy as the mobile apps — **the database enforces all business rules, the client is an input interface only.**

1. Supabase Auth → Identity
2. PostgreSQL → Data
3. Row Level Security → Access
4. SECURITY DEFINER RPCs → Business Logic
5. Client App → Input Interface Only

No business rule may exist exclusively in frontend logic. All writes go through SECURITY DEFINER RPCs — never write directly to Supabase tables from the client. Never hardcode colours — use Tailwind `jokenia-*` tokens.

Unlike the mobile apps, this app is **not** offline-first (single register, wired network expected) — but it does surface online/offline state via the top bar connectivity dot for operator awareness.

---

## 7. Supabase Integration

Client: `src/renderer/src/lib/supabase.ts`
```ts
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
export const supabase = createClient(supabaseUrl, supabaseKey)
```

- **Session storage:** default (supabase-js's own localStorage-backed persistence in the renderer) — persists across app restarts. electron-store is reserved for app preferences only, never for the Supabase session.
- **Auth check on app start:** fetch `profile.role`. If `role = 'staff'`, sign out and show an error — only `admin` and `super_admin` may use this app.
- **Writes:** all via SECURITY DEFINER RPCs, same as the mobile apps. No direct table inserts/updates from the client.
- **Project:** `oiyazguuiqjyrljraodd` (shared with both mobile apps — see JOKENIA_GLOBAL.md for full data model).

---

## 8. Scanner Integration

USB HID barcode scanners present as keyboard devices — characters arrive at <50ms intervals, terminated by Enter.

`ScanInput.tsx`:
1. Renders a visible input, auto-focused on mount.
2. Global `window` keydown listener: if `document.activeElement === document.body` (nothing else focused), programmatically focus the scan input so scans are never lost regardless of what the operator last clicked.
3. On Enter: extract the accumulated value, clear the field, call `onScan(barcode)`.

**Barcode lookup outcomes** (not yet wired to Supabase — scaffolded only, see §13):
| `item_status` | Outcome |
|---|---|
| not found | "Item not found" modal with registration prompt (stub) |
| `in_stock` | Add `CartItem` to the Zustand cart |
| `sold` / `damaged` / `transferred` | Error modal showing the specific status |
| `returned` | "Review required" confirmation modal — confirm adds to cart, cancel dismisses |

---

## 9. Label Printing

`window.electron.print(htmlContent)` (preload) → `ipcRenderer.invoke('print-label', htmlContent)` → main process handler creates a hidden `BrowserWindow`, loads the HTML via a `data:` URL, calls `webContents.print()`, then destroys the window.

**Label content (as of 2026-07-07 — variation-level pivot):** Code 128 bars of `product_variations.barcode` (the stored 13-digit value, e.g. `2000000000001`), with the same 13 digits printed as the human-readable line beneath. No serial number, SKU, size, or price on the label — an earlier design encoded `items.serial_number` instead; that was superseded by this approved pivot to variation-level identity, since a serial-encoded label couldn't be reprinted for restocked/duplicate items of the same variation. **Do not encode as EAN-13** — the stored 13-digit values are sequential and lack valid EAN-13 check digits; only Code 128 accepts them as-is. Old serial-encoded labels remain in physical circulation; `ScanInput.tsx` routes serial-pattern scans to `resolve_serial` separately (see its own dispatch) so both label generations keep scanning correctly. Printing is per-variation with a quantity input (prints N identical labels via repeated `printLabel()` calls — no native multi-copy IPC parameter exists yet, unlike `print-receipt`'s `copies`; if large-quantity runs become a real UX problem, i.e. one print-dialog prompt per label when silent-print is off, add a `copies` field to the `print-label` IPC payload the same way `print-receipt` already does it). Implementation: `src/renderer/src/utils/label.ts` (`generateLabelHtml`/`printLabel`, via `bwip-js/browser`) + `constants/labels.ts` (`LABEL.widthMm`/`heightMm`, currently 20×20mm).

---

## 10. OTA (Auto-Update)

`src/main/index.ts` imports `autoUpdater` from `electron-updater`. On `app.whenReady()`, after `createWindow()`, a 3-second `setTimeout` calls `autoUpdater.checkForUpdatesAndNotify()` — delayed so it never blocks startup. `checkForUpdates()` is also exposed to the renderer (`window.electron.checkForUpdates()`) for a manual "Check for updates" action in Settings.

`electron-builder.yml` → `publish: { provider: github, private: true }`. Owner/repo resolve to the actual GitHub repo once created; not yet set explicitly since no remote exists yet.

---

## 11. Admin Management (implemented)

Settings has a dedicated "Admin Accounts" section (`components/settings/AdminAccountsSection.tsx`), gated `superAdminOnly` the same way the Usage section is (see §16's `ALL_SECTIONS`/`superAdminOnly` filter in `SettingsPage.tsx` — non-super_admin users can never reach it, via the section list itself, not just a role check inside the component). Backed by four SECURITY DEFINER RPCs, all live on production: `get_admin_accounts` (list), `create_admin_account`, `deactivate_admin_account` (mandatory reason, admin-only targets — cannot deactivate a super_admin), `reactivate_admin_account`. Create is a modal (`CreateAdminModal.tsx`) with the same password-visibility SVG toggle as `LoginPage.tsx`. All three mutations invalidate the `['admin-accounts']` react-query key.

---

## 12. Brand and Fonts

Palette (from JOKENIA_GLOBAL.md, defined in `tailwind.config.js` under `theme.extend.colors`) — **always use these Tailwind tokens, never inline hex:**

| Token | Hex |
|---|---|
| `jokenia-dark` | `#3D3D2E` |
| `jokenia-dark2` | `#56503E` |
| `jokenia-gold` | `#C9A96E` |
| `jokenia-cream` | `#F5EDD8` |
| `jokenia-cream2` | `#F2EDE4` |
| `jokenia-tan` | `#8B6F47` |
| `jokenia-sand` | `#D4B483` |

Fonts: **Syne** (`font-heading`) for headings, **DM Sans** (`font-sans`, default body) for UI text — both loaded via Google Fonts CDN in `src/renderer/index.html`, matching the admin app's font pair (the staff app uses system font instead — do not import staff app tokens here).

---

## 13. Known Patterns

- **electron-store must stay on v8.x.** v9+ is pure ESM; imported into the main process (built as CJS by electron-vite with `externalizeDepsPlugin`), `import Store from 'electron-store'` resolves to the wrong object shape and throws `TypeError: Store is not a constructor` at app launch. Pin `"electron-store": "^8.2.0"` — confirmed working with `npm run dev`.
- **A local `.env` with real `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` is now required for `npm run dev`.** As of Phase 2 (auth flow), `App.tsx` imports `lib/supabase.ts` and calls `supabase.auth.getSession()` on mount. `createClient()` throws synchronously (`supabaseUrl is required.`) if the env vars are unset, which blanks the renderer before React mounts. Phase 1 never hit this because nothing imported the Supabase client yet. `.env` is gitignored — copy `.env.example` and fill in real values locally.
- **Import `bwip-js` via its `bwip-js/browser` subpath, not the bare `bwip-js` specifier.** The package's root export map gates on custom condition keys (`browser`/`electron`/`node`) that `tsc`'s `moduleResolution: "bundler"` doesn't recognize without a `customConditions` tsconfig entry — `import bwipjs from 'bwip-js'` fails typecheck with `TS2307: Cannot find module`. `bwip-js/browser` resolves through standard `types`/`import`/`require` conditions instead. No separate `@types/bwip-js` package is needed — bwip-js ships its own bundled `.d.ts` files.
- **Settings sections needing a super_admin gate reuse `SettingsPage.tsx`'s existing `ALL_SECTIONS`/`superAdminOnly` filter** (established by the Usage section, reused as-is by Admin Accounts) rather than a role prop + in-component early-return — the section is filtered out of the sidebar and out of the `?section=` deep-link match before the component ever mounts, so a non-super_admin can't reach it even via a crafted URL param. The RPC's own `SECURITY DEFINER` role check is the real enforcement boundary regardless; this filter is the UI-layer mirror of it.
- **Settings-section mutations (create/deactivate/reactivate-style actions) call `supabase.rpc(...)` directly inside a local async handler with its own `submitting`/`error` state, then `queryClient.invalidateQueries({ queryKey: [...] })` on success** — same pattern as `components/services/NewTicketForm.tsx`/`TicketDetail.tsx`. Not `useMutation` — this codebase doesn't use react-query's mutation helper anywhere yet, so introducing it in one isolated component would be an inconsistent one-off.

---

## 14. Dispatch Protocol

See CLAUDE_OPS.md for the full ops bridge protocol. Reference values for this component:

| Field | Value |
|---|---|
| Ops project ID | `cbvbixizegkbjwgsqzuh` |
| Jokenia project_id (filter) | `7f945045-e145-436f-a882-5de8129276a0` |
| session_type | `Desktop App` |

---

## 15. Release & OTA Workflow

### Pre-release checklist
1. Working tree must be committed **and pushed to `origin/main`** before releasing — a release published from an uncommitted or unpushed tree leaves the repo unable to reproduce what's actually running on the shop PC.
2. Bump the `version` field in `package.json`, commit, and push.

### Publishing a release
```powershell
$env:GH_TOKEN = (gh auth token)
npm run release
```
`release` runs `electron-vite build && electron-builder --publish always` (`package.json`). This builds the NSIS installer and publishes it, `latest.yml`, and the installer's `.blockmap` to GitHub Releases per `electron-builder.yml`'s `publish` block (`provider: github`, `owner: Cr1spCr1ms0n`, `repo: jokenia-desktop`).

**Duplicate-draft check (mandatory — electron-builder upstream issue [#6676](https://github.com/electron-userland/electron-builder/issues/6676)):** a single `npm run release` can non-deterministically split assets across **two** draft releases sharing the identical tag — a GitHub API eventual-consistency race in electron-builder's per-artifact "does this release already exist" check, not a bug in this repo's config (`electron-builder.yml` is not the cause and should not be changed to work around it). Already hit twice in this repo's own history (v1.0.3, v1.0.4 — each time the installer `.exe`/`latest.yml` landed on one release and the `.blockmap` landed on a second, orphaned one). Immediately after `npm run release`, before un-drafting, run:
```powershell
gh api repos/Cr1spCr1ms0n/jokenia-desktop/releases --jq '.[] | select(.tag_name=="v<version>")'
```
Exactly one release object must return. If two: identify the complete one (or consolidate — download the missing asset(s) from the incomplete draft and re-upload them onto the survivor with `gh release upload v<version> <file>`), delete the incomplete duplicate (`gh release delete` targets by tag and is ambiguous when two releases share one — use `gh api -X DELETE repos/Cr1spCr1ms0n/jokenia-desktop/releases/<id>` with the specific numeric id instead), then re-run the check above until it returns exactly one release. `latest.yml`, the installer `.exe`, and the `.blockmap` must all sit on the single surviving release before proceeding.

**electron-builder always creates the release as a DRAFT.** `electron-updater` cannot discover draft releases — after the duplicate-draft check above confirms a single, complete release, un-draft it on GitHub (e.g. `gh release edit v<version> --draft=false`), or OTA will silently never find the update.

### Verify before considering a release live
Confirm the published release's assets include all three:
- `Jokenia-Operations-Setup-<version>.exe` — the NSIS installer (`nsis.artifactName`)
- `latest.yml` — electron-updater's version manifest; without it, update checks fail silently
- the installer's `.blockmap` — enables differential downloads

### Delivery mechanics
- `electron-updater` polls GitHub Releases on boot (`autoUpdater.checkForUpdatesAndNotify()` in `src/main/index.ts`, wrapped in `if (!is.dev)`) — **not commits**. Pushing to `main` alone does nothing until a release is published and un-drafted.
- Once found, the update downloads silently in the background.
- `autoInstallOnAppQuit = true` — the update installs automatically the next time the app quits, even if the operator never touches the update dialog.
- The runtime `update-downloaded` dialog also offers an immediate "Restart now" option, calling `quitAndInstall(false, true)`.

### Local OTA testing pattern
- Test against the installed NSIS app only — never `win-unpacked` (`electron-builder --dir` output cannot self-update).
- Install a build at a version **lower** than the one you're about to publish (a "dummy" old build), then publish the higher version and confirm the installed app picks it up on its next launch.

### No channel separation
There is a single publish target — any release published and un-drafted is immediately visible to every installed copy of the app, including the shop PC, on its next launch. There is no staging/beta channel. Coordinate release timing with Samuel if the shop PC is in active use.

### History
v1.0.0's initial OTA wiring had listener-scoping bugs (`update-available`/`update-downloaded` registered outside the `if (!is.dev)` guard) and no `autoUpdater.on('error', ...)` handler, so a broken update couldn't reliably self-heal past its own bug. Fixed in commit `158fcef` ("feat: markets, consignees, receipt printing, OTA dialog fix, item discounts, branded icon"). The shop PC required a one-time manual install of the fixed build to recover.

---

## 16. Settings Module & IPC Bridge Pattern

The Settings tab (`pages/SettingsPage.tsx`) is a section switcher (Updates, Startup & Tray, Printing, Display, Account, Diagnostics — `components/settings/*.tsx`), selected via a `?section=` query param so different entry points can deep-link into a specific section. The gear icon opens the default (Updates) section; the TopBar avatar deep-links straight to `?section=account`.

**Ownership rule:** all settings values live in the main process's `electron-store` instance (`preferencesStore` in `src/main/index.ts`), keyed `settings.<name>`. The renderer never touches `electron-store`, `app`, or `shell` directly — every read/write goes through a preload bridge method (`getPreference`/`setPreference` for plain key/value settings; dedicated methods for settings with a real side effect the main process must perform).

**Two categories of setting:**
- **Plain persisted values** (silent-print toggle, auto-print toggle, receipt copy count, default printer names, zoom level, start-minimized/minimize-to-tray/close-to-tray flags, last-update-checked timestamp) — renderer calls the existing generic `getPreference(key)` / `setPreference(key, value)` IPC, no new channel needed per setting.
- **Values with a real OS-level side effect** — `getLoginAtStartup`/`setLoginAtStartup` (wraps `app.getLoginItemSettings()`/`setLoginItemSettings()`, source of truth is the OS registration, not just the store), `getPrinters` (`webContents.getPrintersAsync()`, live query, not stored), `openLogsFolder` (`shell.openPath(app.getPath('logs'))`). These get their own dedicated preload/IPC methods since a plain store round-trip wouldn't actually perform the action.

**Push events (main → renderer):** the OTA "Check for updates" button needs live state (checking → downloading % → downloaded/error), not just a fire-and-forget invoke. Pattern: main registers `autoUpdater.on(...)` listeners that call `mainWindow.webContents.send('updater-event', payload)`; preload exposes `onUpdaterEvent(callback)` wrapping `ipcRenderer.on`/`removeListener` and returning an unsubscribe function; the renderer subscribes in a `useEffect`. These state-broadcasting listeners are registered **unconditionally** (not gated on `!is.dev`) so the Settings UI shows real state whenever a check is manually triggered — they were added as additional listeners alongside the pre-existing `!is.dev`-gated native dialog block (`update-downloaded` → "Restart Now" dialog, `quitAndInstall`), not folded into it, so that already-fixed dialog logic (commit 158fcef) is reused untouched rather than duplicated. Use this same push pattern for any future main→renderer live-state need.

**Tray & window lifecycle:** `mainWindow` and `tray` are module-level (`let`) in `src/main/index.ts` so IPC handlers, the tray menu, and window event listeners can all reference the same instances. `close-to-tray` intercepts the window's `close` event (cancelable) and hides instead of quitting, gated by a module-level `isQuitting` flag set `true` only by the tray menu's "Quit" item and `app.on('before-quit')` — this is what lets a real quit still work. `minimize-to-tray` is different: the `'minimize'` event is **not** cancelable (no `preventDefault`), so it just hides the window immediately after the event fires rather than trying to stop the minimize.

**Known environment limitation:** the manual "Check for updates" button cannot be exercised end-to-end in an unpacked/dev run — `autoUpdater.checkForUpdatesAndNotify()` has no `app-update.yml` to read outside a packaged build and its promise never settles, so the button sticks on "Checking…" with no error. This is the same underlying constraint that has kept OTA round-trip verification out of scope for every session since v1.0.0 (see §15 history) — it is not a defect in the Settings wiring, and `forceDevUpdateConfig` should not be reintroduced to work around it (see the Fix commit 4b904dfe note in CLAUDE_LOG.md for why that was removed). Live verification of this button requires a packaged install pointed at real GitHub Releases.

**Non-Settings persisted state reuses the same generic IPC, under its own key prefix:** the "plain persisted value" pattern above isn't exclusive to the Settings tab — anything that needs to survive an app restart via `electron-store` should use the existing `getPreference`/`setPreference` IPC rather than adding new channels, provided it has no real OS-level side effect. To keep the flat `electron-store` keyspace legible, give each feature area its own prefix distinct from `settings.*` (e.g. checkout channel/market-event/online-platform persistence uses `checkout.*` — see `appStore.ts`'s `hydrateChannelState`/`clearChannelState`). Hydration on "app start" can be done from whichever component only ever mounts post-auth (e.g. `Register.tsx`, always inside the authenticated `AppShell`) instead of touching `App.tsx`.
