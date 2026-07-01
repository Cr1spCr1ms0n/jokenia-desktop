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

Label content fields (renderer to build, not yet implemented): barcode (Code128), serial number, SKU, size, price. Label size read from `electron-store` key `labelSize` (default `{ width: 50, height: 30 }` mm) via `getPreference('labelSize')` — configurable from the Settings tab once implemented. Only the IPC round-trip is scaffolded this session; the actual label HTML renderer is a follow-up.

---

## 10. OTA (Auto-Update)

`src/main/index.ts` imports `autoUpdater` from `electron-updater`. On `app.whenReady()`, after `createWindow()`, a 3-second `setTimeout` calls `autoUpdater.checkForUpdatesAndNotify()` — delayed so it never blocks startup. `checkForUpdates()` is also exposed to the renderer (`window.electron.checkForUpdates()`) for a manual "Check for updates" action in Settings.

`electron-builder.yml` → `publish: { provider: github, private: true }`. Owner/repo resolve to the actual GitHub repo once created; not yet set explicitly since no remote exists yet.

---

## 11. Admin Management (placeholder)

Settings tab currently shows a placeholder note. Blocked on backend RPCs that don't exist yet:
- `create_admin_account`
- `deactivate_admin_account`

Do not implement the Settings admin-management UI until a Backend session delivers these RPCs (tracked as a follow-up in CLAUDE_LOG.md).

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

---

## 14. Dispatch Protocol

See CLAUDE_OPS.md for the full ops bridge protocol. Reference values for this component:

| Field | Value |
|---|---|
| Ops project ID | `cbvbixizegkbjwgsqzuh` |
| Jokenia project_id (filter) | `7f945045-e145-436f-a882-5de8129276a0` |
| session_type | `Desktop App` |
