# stickynotes — plan & status

Read this first in a new session. Last updated 2026-10-09.

## What it is
A Chrome/Edge/Brave extension plus a web library. Select text on any page and it is saved as a bullet
under the page's section heading, filed into a **topic**: one note per subject, not per URL. Ten articles
on consistent hashing become one "Consistent hashing" note with a Sources list at the end. Google
sign-in, private by default, share a topic by link, export, delete account.

## Repos (initial commits pushed to `main`)
| Repo | What | Run |
|---|---|---|
| `stickynotes/` (hridyeshh/stickynotes) | Next.js 15 site at the root; extension goes in `extension/` (phase 3) | `npm install && npm run dev` (:3000) |
| `stickynotes-backend/` (hridyeshh/stickynotes-backend) | Go API, mirrors `../paperboxd-backend` | `make docker-up && make dev` (:8080), `make test` |

Env files, both gitignored:
- `stickynotes/.env`: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, optional API_URL.
- `stickynotes-backend/.env`: DATABASE_URL, JWT_SECRET, GOOGLE_CLIENT_IDS, PORT.

**Never reuse paperboxd env values.** Google Cloud project "stickynotes" has one Web OAuth client.
Its redirect URI is `http://localhost:3000/api/auth/callback/google`, so stop paperboxd's dev server (also :3000) first.

## Design source
- Claude Design project `6442e43f-b855-4ffb-922a-5f52b3610e64`. Read it with DesignSync `get_file` after `/design-login`.
- `stickynotes Prototype.dc.html` has 8 screens (Landing, Sign in, Onboarding, Library, Page notes,
  Public share, Settings, Extension demo) plus the share and delete dialogs.
- The Classical design system is copied to `app/classical.css`. App styles live in `app/site.css`: tokens
  only, outline buttons, Lucide icons.
- Original v1 extension: `~/Desktop/highlight-notes.zip`, identical to the design project's `uploads/`.

## Decisions
- **Backend:** Go/chi + pgx/sqlc + golang-migrate (embedded, runs on boot), slog, `types.WriteError`, all
  copied in style from paperboxd-backend. No Supabase. Authorization is in app code: every query filters by user_id.
- **Web sign-in:** the website runs Google OAuth itself (`app/api/auth/google` → callback, with state + PKCE).
  - It sends Google's id_token to Go `POST /api/v1/auth/google`.
  - Go verifies the token via tokeninfo against an `aud` allowlist and upserts the user by Google `sub`.
  - Go returns a 15-minute JWT plus a 60-day refresh token (hashed, rotated, one per device).
  - The web keeps both in HttpOnly cookies `sn_access` / `sn_refresh`; `middleware.ts` refreshes them on protected routes.
  - No NextAuth, so there is one session instead of two.
- **Connecting the extension (phase 3):** the website owns login.
  - Popup "Connect" opens `/extension/connect`.
  - The page talks to the extension through the content-script bridge and gets a PKCE challenge.
  - Go mints a single-use code that lasts 60 s.
  - The extension swaps the code plus its verifier for its own refresh token.
  - Tokens never cross the bridge. Fallback: `chrome.identity.launchWebAuthFlow`.
- **Privacy rule:** the extension sends nothing until a note is saved. No per-page lookups.
- **Data:**
  - topics: client UUID; unique lower(title) per user.
  - sources: one per URL; unique (user, url); http(s) only.
  - highlights: client UUID; text up to 10k characters; section; anchor jsonb.
  - Deleting a note sets deleted_at and blanks the text. Deleting the account is a hard cascade.
  - Schema: `stickynotes-backend/migrations/000001_init.up.sql`.
- **Sync (phase 3):**
  - Push sends repeat-safe actions (create_topic, create_highlight, delete_highlight, move_source). The server merges topics with the same title and returns an id map.
  - Pull fetches `updated_at > cursor - 5 min`. Deletion markers remove local copies and on-page highlights.
  - Triggers: on save, on popup open, and every 5 minutes via alarms.
- **Topic matching (phase 4):** runs inside the extension, locally.
  - Take the words of the page `<h1>`/`<title>`, dropping filler ("a guide to", "explained", site suffix).
  - An existing topic whose words all appear in the page words wins, most specific first. Otherwise create a new topic.
  - The toast reads "Saved to X · Change"; the website has Move source and Merge.
- No CORS: browser → Next server → Go, and the extension uses host_permissions. No Redis (see Deploy).

## Phases
- [x] **1. Backend foundation.** Auth endpoints (`/auth/google`, `/refresh`, `/logout`, GET/DELETE `/me`),
  migration 000001 with every table, and tests (`make test`: unit plus integration against docker Postgres on :5433).
- [x] **2. Web skeleton + sign-in.** Done and verified 2026-10-09. Build, lint and test pass. A real Google
  sign-in lands on `/library` and Sign out works; the API logged auth/google 200, me 200 and logout 204.
  - `next` bumped to 15.5.27 to clear critical RCE advisories.
  - `typescript` pinned to ^5: TypeScript 7 lacks the JS API that Next 15 calls.
  - oxlint has no `no-restricted-syntax`, so the design check is now a hex/px grep over `.tsx` in `npm run lint`.
  - A local smoke test also passed: open redirects are blocked, the Google redirect carries PKCE S256 + state,
    and both callback error paths work.
  Pages: `/` landing (topic copy), `/signin`, `/privacy` and `/terms` (drafts), `/library` placeholder.
- [~] **3. Sync end to end.** Built 2026-10-09 on branch `phase-3` in both repos (local commits, not pushed). The Go
  integration test and the extension unit tests pass. The browser glue (bridge, popup, worker) is untested until the
  morning check below.
  - **Go:**
    - `/extension/codes` and `/extension/token`: PKCE S256, single-use codes that last 60 s.
    - `/sync/push`: create_topic, create_highlight, delete_highlight, move_source. Each action runs in its own
      savepoint. A same-title topic merges, and the response returns an id map.
    - `/sync/pull`: everything since cursor − 5 min, with deletion markers. A delete that empties a source deletes it too.
  - **Extension:**
    - v1 was imported unchanged first (`2877abe`).
    - `config.js` holds the API and web origins.
    - `sync.js` is the store and outbox, tested under node.
    - `background.js` is the only writer: queued writes, push then pull, a 5-minute alarm, one refresh in flight.
    - `content.js` saves through the worker and keeps the query string in the URL. It carries the bridge.
    - The popup has Connect/Disconnect; the notes page groups by topic, with v1-compatible Backup/Restore.
  - **Web:** `/extension/connect` (signed-in only) hands the extension a code through the bridge.
  - Changed from the plan:
    - No v1 `pages` migration: there were no v1 notes to keep, and v1 backups still import via Restore.
    - No `launchWebAuthFlow` fallback; add it if the bridge proves flaky.
    - The topic is the page heading until phase 4's matcher.
  - Fixed 2026-10-11, found in the morning check (checked in a real headless Chrome):
    - Save to notes (menu or Alt+S) did nothing in a tab opened before the extension was loaded, reloaded or
      updated, because Chrome gives such a tab no live content script. The worker now injects one first
      (`activeTab` + `scripting`).
    - The popup never got the tab's URL (content-script matches aren't host permissions), so it always said
      "No notes on this page yet". `activeTab` fixes that too.
    - A content script orphaned by a reload threw "Extension context invalidated". It now removes its button.
  - **Morning check (about 5 min):**
    1. Run the backend from branch phase-3 (`make docker-up && make dev`) and the web (`npm run dev`).
    2. chrome://extensions → Developer mode → Load unpacked → `stickynotes/extension`.
    3. Popup → Connect → sign in if asked. The page should say "Connected as …".
    4. Save a passage on any article: toast "Saved to …"; the popup lists it and shows "Syncing as …" with nothing waiting.
    5. Load and connect the extension in a second Chrome profile. Open its popup: the note appears.
    6. Delete the note in one profile, then open the other's popup: it is gone.
    7. Disconnect: the popup shows Connect. Connect again and the note comes back from the account.
    8. Then merge `phase-3` into main in both repos. Pushing the backend's main deploys to Railway.
- [~] **4. Topics + extension UX.** Built 2026-10-10 on branch `phase-4` of this repo (local commit, stacked on
  `phase-3`; the backend needed no changes). `npm test` (17 tests) and lint pass. Headless Chrome ran `content.js` on
  a test page with `chrome.*` stubbed: it saved two passages (one across an `<em>`), found a repeated sentence's
  second copy by its anchor, and restored it on load. The real extension is untested until the check below.
  - `page.js`, one module in place of the plan's url/topic/anchor:
    - Address: the canonical link, when it is on the same site, isn't the homepage for every page, and wasn't left
      behind by in-app navigation. Otherwise the URL without utm_*/fbclid/gclid-style parameters or the #hash.
    - Topic: the h1, else the title without the site's name, minus filler ("A guide to", "explained"). An existing
      topic whose words all appear wins, most words first. Topics with no notes left are skipped.
    - Anchor: the passage plus 32 characters either side, compared without whitespace.
  - `content.js`:
    - Classical button and toast (Undo / Change / View) in a closed shadow root.
    - Marks are restored on load, again 2.5 s later, and after in-app navigation (Navigation API).
    - See-through amber marker, and a "Restored N highlights" banner.
  - `background.js`:
    - Knows which page each tab shows, so the badge counts its notes and marks follow deletes, undo and pulls.
    - A page may undo or refile only a note it saved in the last 10 minutes.
    - Keeps the store in memory, and syncs again when a save lands during a pull.
  - Popup per the design: the page's topic, note and section counts, sync state, auto-save switch, This page's notes
    and Library. The auto-save setting moved to `chrome.storage.sync`.
  - Changed from the plan:
    - One `page.js` instead of three modules.
    - View, This page's notes and Library open the extension's notes page until phase 5 adds `/library` and `/t/[id]`.
    - Georgia stands in for Cormorant Garamond and Lora; the extension doesn't bundle fonts.
  - **Browser check (about 10 min, after phase 3's):**
    1. In this repo, `git switch phase-4`. In chrome://extensions, reload stickynotes, then reload open article tabs.
    2. Save a passage on an article titled "X explained" or "A guide to X". The toast says "Saved to X", then
       "Synced to your library", and the badge shows 1.
    3. Reload the page. The passage is tinted again and "Restored 1 highlight from your last visit" shows.
    4. Save on a second article on the same subject: it goes under the same topic.
    5. Toast → Change → pick or type a topic. The toast says "Saved to <that topic>"; the notes page agrees.
    6. Toast → Undo on a fresh save: the tint and the note go, and the badge drops.
    7. On a dark site the tint is readable. On YouTube, open another video without reloading and save: the note
       goes under that video.
    8. Then merge `phase-3`, then `phase-4`, into main.
- [ ] **5. Web library.**
  - `/library`: topic cards, client-side search.
  - `/t/[id]`: merged sections, `[n]` source markers, Sources list, rename, delete, copy MD, move source, merge, delete bullet.
  - Share dialog plus `/s/[slug]`: SSR, noindex, OG tags, 12-character slug.
  - `/settings`: account, devices (from refresh_tokens) with disconnect, export MD/JSON, delete account.
  - `/onboarding`: bridge shows Added / Connected.
  - `/sample` article.
  - Add the new routes to the middleware matcher.
- [ ] **6. Tags + AI (optional).** Tags and filter chips; suggestions and a topic-match fallback via the Claude API
  from Go. It sends note text to a third party, so disclose it and default it off.
- [ ] **7. Ship.**
  - Railway (API + Postgres), Vercel (web), custom domain.
  - Google consent screen to Production: privacy/terms URLs, prod origin and redirect URI.
  - Chrome Web Store (`<all_urls>` justification), then Edge.

## Bugs in the v1 extension (fixed: the 1st, 2nd and 4th in phase 3, the rest in phase 4)
- `content.js:11` drops the query string, so HN `item?id=` and YouTube `watch?v=` pages collapse into one note.
- `content.js:92-102`: every tab read-modify-writes one `pages` blob, so concurrent saves can be lost.
- `popup.js:4` works out the page key separately from the content script.
- Note ids are not UUIDs.
- Highlights disappear on reload.

## Deviations from the prototype (v1)
- Google sign-in only; no email magic link.
- No simulated extension demo; a real `/sample` page instead.
- The web shows only a header sync pill, not per-page "waiting to sync".
- No JSON restore, dark mode, or highlight-style toggle.
- The in-page button and toast use Georgia.
- Added beyond the prototype: Sources list, Change-topic picker, Move/Merge dialogs.

## Deploy
**Backend on Railway** (like paperboxd): push the repo, create a service from GitHub, and add a Postgres
service. Variables:
- `DATABASE_URL=${{Postgres.DATABASE_URL}}`
- `JWT_SECRET`: a fresh `openssl rand -hex 32`, not the local one.
- `GOOGLE_CLIENT_IDS=<web client id>`
- Railway sets PORT itself.

Health check path `/health`. Migrations run on boot. Redis is not needed (no cache, and the in-memory
rate limit is fine on one instance); add it with httprate-redis only when running more than one replica.

Status 2026-10-09: Railway project `diplomatic-truth` (auto-named) has `stickynotes-backend` (deploys from
GitHub `main` via Railpack) and `Postgres` (private network only). `stickynotes-backend/` is `railway link`ed.
The three variables are set, and the backend boots against Postgres with migrations applied. Redis was skipped
again on 2026-10-09. Still to do:
- Set the `/health` health check path (dashboard → Settings). Without it, a crash-looping deploy shows SUCCESS.
- Add a public domain (`railway domain`) once the web needs one.

**Web on Vercel** (phase 7): set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and API_URL=<Railway URL>. Add the
prod origin and `https://<domain>/api/auth/callback/google` to the Google OAuth client.

## Known limits (marked with ponytail comments in the code)
- The extension store is one storage key, rewritten on every save. Split it per record if stores reach many MB.
- A first pull sends every live note in one response. Page it past tens of thousands of highlights.
- If the extension's worker stops between the API rotating its refresh token and storing the new one, the
  extension has to be connected again.
- For production, set the origins in `extension/config.js` and the API origin in the manifest's host_permissions.
- `npm audit` still flags postcss 8.4.31, which Next 15 pins; the fix needs Next 16. It only matters for
  untrusted CSS, and the app processes none.
- Each sign-in makes one tokeninfo round-trip to Google.
- The refresh rate limit is keyed by IP behind the Next server.
- Two tabs refreshing at the same moment can send one of them to `/signin`.
- Marks are found again by their text plus 32 characters either side. Passages inside iframes or other shadow roots,
  or selections that cross hidden text, aren't restored; the note itself is kept.
- Change leaves the old topic in place with no notes. Topic matching skips it; the web library should hide or delete
  empty topics (phase 5).
- Tabs that were open before the extension was installed or reloaded need a reload before they can save.
