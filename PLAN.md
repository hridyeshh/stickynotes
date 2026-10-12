# stickynotes — plan & status

Read this first in a new session. Last updated 2026-10-12.

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
- **Saving into a topic you are reading (2026-10-12):** the in-page bar shows where a save goes ("to X ▾") and can
  pick another topic before saving. That choice moves the whole page with its notes. A page new to your notes goes
  to the topic you are reading in (your last save or pick) until you pick another or stop saving for 3 hours; only
  then does topic matching decide. Stored in the extension as `current` (`background.js`, `plan` handler).
- **Highlight colours (2026-10-12):** yellow, pink, blue, green. Clicking a colour on the bar saves in it; Save note
  and Alt+S use your last one. `highlights.color` (migration 000002, default yellow) syncs both ways, and the topic
  and share pages show each note with a highlighter swipe in its colour.
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
- [x] **3. Sync end to end.** Built 2026-10-09 on branch `phase-3` in both repos. Merged into `main` and pushed
  2026-10-12 with phase 4; Railway deployed it and it booted clean. The Go integration test and the extension unit
  tests pass. The user's browser check passed 2026-10-12: connect, save, a second profile, delete, and disconnect then reconnect.
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
  - Found 2026-10-12: a saved note never reached the account because the extension was never connected (no
    `/extension/codes` call in the API log); unconnected saves wait in the outbox. The connect bridge was then checked
    in a real headless Chrome: hello → challenge, and a bad code → "This connection attempt expired."
- [x] **4. Topics + extension UX.** Built 2026-10-10 on branch `phase-4` of this repo (stacked on `phase-3`; the
  backend needed no changes). Merged into `main` 2026-10-12. `npm test` and lint pass. Headless Chrome ran `content.js` on
  a test page with `chrome.*` stubbed: it saved two passages (one across an `<em>`), found a repeated sentence's
  second copy by its anchor, and restored it on load. The user's browser check passed 2026-10-12.
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
  - Fixed 2026-10-12 (uncommitted on `main`): notes saved before phase 4 sit under the raw address. One example is YouTube's
    `&start_radio=1`, which the canonical link drops. Those notes never came back on the page. A page now also
    reports its raw and cleaned addresses, and the worker tracks the tab under all of them (test in `background.test.js`).
  - Changed from the plan:
    - One `page.js` instead of three modules.
    - View, This page's notes and Library open the extension's notes page until phase 5 adds `/library` and `/t/[id]`.
    - Georgia stands in for Cormorant Garamond and Lora; the extension doesn't bundle fonts.
- [x] **5. Web library.** Built 2026-10-12 on `main` in both repos; committed and pushed (web `97713a7`, API `70d1300`,
  Railway deployment `0964a59e`). `make test` (TestLibrary added), `npm test`, lint and tsc pass. A real headless Chrome
  with the extension loaded and a throwaway account (deleted after) passed every page below, including connecting from
  /onboarding and the extension pulling the account's notes. The user's browser check passed 2026-10-12.
  - `/library`: topic cards, latest first, client-side search; topics with no notes left are hidden.
  - `/t/[id]`: merged sections, `[n]` source markers, Sources list, rename, delete, copy MD, move source, merge, delete bullet.
  - Share dialog plus `/s/[slug]`: SSR, noindex, OG tags, 12-character slug.
  - `/settings`: account, devices (from refresh_tokens) with disconnect, export MD/JSON, delete account.
  - `/onboarding`: bridge shows Added / Connected.
  - `/sample` article.
  - The new routes are in the middleware matcher; `/s` and `/sample` are public.
  - **Go:**
    - `GET /library` returns every live topic, source and note.
    - `GET /shared/{slug}` is public.
    - `POST /topics/{id}/share`.
    - `GET /devices` and `DELETE /devices/{id}`.
    - `/me` adds `extension_seen_at`.
    - Push gains `rename_topic`, `delete_topic` and `merge_topic`. All web edits go through `/sync/push`, so the
      extension picks them up on its next pull.
  - **Extension:** the bridge answers `sn:ping` (onboarding's "Added"). When connected with nothing waiting to sync,
    "This page's notes", Library and the toast's View open the web library.
  - Changed from the plan:
    - Going private kills a share link for good; sharing again makes a new one. The share page shows the owner's
      name, and the dialog says so.
    - A note saved offline into a topic that was since deleted or merged brings that topic back.
    - Sign-in now sends the browser's user agent so Settings can name devices. Older sessions show "A web browser".
    - Settings can't mark "this browser": the access token doesn't say which session it belongs to.
    - Onboarding has no Chrome Web Store link until phase 7. "Suggest tags" waits for phase 6.
- [ ] **6. Tags + AI (optional).** Tags and filter chips; suggestions and a topic-match fallback via the Claude API
  from Go. It sends note text to a third party, so disclose it and default it off.
- [~] **7. Ship.** Started 2026-10-12. Waiting on the domain the user is buying.
  - Done: `stickynotes-backend/railway.json` sets the `/health` health check (it applies from the next deploy).
  - Once the domain exists:
    - Railway: `railway domain` for the API (generated or `api.<domain>`).
    - Vercel: import the repo; set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, API_URL=<API origin>; add the domain.
    - Extension: both origins in `config.js`, the API origin in the manifest's host_permissions, version 1.0.0.
    - Google OAuth client: add the prod origin and `https://<domain>/api/auth/callback/google`. Verify the domain in
      Search Console, then move the consent screen to Production with the homepage, privacy and terms URLs.
    - `/privacy` and `/terms`: a contact address on the domain; drop "Draft".
  - Needs the user:
    - Store art: 1280×800 screenshots and a 440×280 promo tile.
  - Icons: done 2026-10-12.
    - The design is a yellow highlighter character on muted sky (candidate C1 of six from GPT Image 2.5 via Figma,
      chosen by the user). The source is `brand/stickynotes-icon.png` (1024).
    - Cut from it: `app/favicon.ico` (16/32/48), `app/icon.png` (192), `app/apple-icon.png` (180, full bleed),
      `extension/icons/16|32|48|128.png` (the 128 padded to the store's 96px artwork), and the header mark.
    - A Chrome Web Store developer account: registered (fee paid) 2026-10-12.
  - Store listing draft:
    - Single purpose: save text you select on a web page as a note, grouped by topic with its sources.
    - Content script on all sites: shows the Save button for a selection and re-tints saved passages on return.
      Nothing is sent until a note is saved.
    - activeTab + scripting: Save from the menu or Alt+S in a tab opened before the extension was installed.
    - storage + unlimitedStorage: notes are kept on the device and work offline.
    - contextMenus: the "Save to notes" item. alarms: sync every 5 minutes.
    - Host permission (the API origin): sync notes with the user's account. No remote code.
  - Then Edge Add-ons with the same zip (tests excluded).

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
- No JSON restore or dark mode. Highlights come in four colours (added 2026-10-12).
- The in-page button and toast use Georgia.
- Added beyond the prototype: Sources list, Change-topic picker, Move/Merge dialogs.
- The site was redesigned 2026-10-12 after Superr's site on Mobbin (superr.ai). The DS type and amber stay; the
  rest is new. Everything is CSS/SVG except two generated paintings: the sign-in desk (`public/art/desk.jpg`) and
  the setup desk (`public/art/setup.jpg`).
  - **Landing, with motion (any screen):** the hero notebook stays on screen as you scroll. It straightens, grows and opens,
    then turns six spreads: welcome, select / files itself, ten articles / the merged note, sticky-note features /
    comes back, the privacy letter / the no-list, cool stuff / Get started.
    - `components/scrolly.tsx` publishes scroll progress as `--p`. `app/landing.css` derives every transform from
      it. Leaves stack by translateZ.
    - Paper leaves bend while turning: each is four hinged strips (`SoftLeaf`), and every hinge adds
      `sin(2πt)·13°`. The free edge leads, then trails. Strips 2–4 repeat the page markup and are `aria-hidden`.
      The kraft cover turns stiff.
    - Phones and short screens show one page at a time: a camera (`--c`) reads the left page, slides to the right
      one, then follows each turning page back. The hero copy stands on the notebook (`--hv`), its title always
      three lines, so the gaps hold at any height.
  - **Landing without motion** (reduced motion or no JS, set by a media query): the same pages stack like spreads.
    Then come a topic shelf (it slides sideways while you scroll, and is swiped without motion) and an FAQ.
  - **Shared props:**
    - Notebooks with a name label (`components/notebook.tsx`), sticky notes, die-cut stickers, a pencil, and
      Caveat handwriting (`.hand`), which is now loaded for every page.
    - Sticker buttons, and floating paper-pill headers.
    - A mechanical-pencil cursor, which steps aside for forced colours and high contrast.
  - **App pages:**
    - The library is a shelf of notebooks, coloured by topic id, each with its latest note on a sticky note.
    - Topic and share pages are loose-leaf pages.
    - Settings are index cards; sign-in is a nameplate card; dialogs sit on paper.
    - Onboarding and the connect page are one setup notebook (`components/setup.tsx`) on their own desk: the steps
      are yellow, pink and blue sticky notes on the kraft inside cover, ticked off as you go, and the ruled page says
      what to do now. "Add to Chrome" shows once `NEXT_PUBLIC_EXTENSION_URL` is set; "I've added it" reloads,
      since the extension only greets pages loaded after it.
  - **Footer and 404:** the public footer is an amber slab with the name pressed in. The 404 (`app/not-found.tsx`)
    is a loose-leaf page with page 404 torn out at the binding: its stub keeps the first letters of each line.
  - **CTAs:** they say "Get started free" and go to sign-in until the Web Store listing exists (phase 7).
  - **Checked:** in headless Chrome at 1440, 1024, 490 and 390 wide; onboarding and connect through an unauthenticated
    preview route in a scratch copy. The in-page bar was checked with the real extension in headless Chrome (colour
    save, picker, the next page keeping the topic). Lint, tsc, 26 unit tests and `next build` pass. The backend
    builds and vets; its integration tests need Docker, which was not running.

## Deploy
**Backend on Railway** (like paperboxd): push the repo, create a service from GitHub, and add a Postgres
service. Variables:
- `DATABASE_URL=${{Postgres.DATABASE_URL}}`
- `JWT_SECRET`: a fresh `openssl rand -hex 32`, not the local one.
- `GOOGLE_CLIENT_IDS=<web client id>`
- Railway sets PORT itself.

Health check path `/health`. Migrations run on boot. Redis is not needed (no cache, and the in-memory
rate limit is fine on one instance); add it with httprate-redis only when running more than one replica.

Status 2026-10-12: `main` with phase 5 deployed (0964a59e, `70d1300`) and booted. Railway project `diplomatic-truth` (auto-named) has `stickynotes-backend` (deploys from
GitHub `main` via Railpack) and `Postgres` (private network only). `stickynotes-backend/` is `railway link`ed.
The three variables are set, and the backend boots against Postgres with migrations applied. Redis was skipped
again on 2026-10-09. Still to do:
- `railway.json` sets the `/health` health check path from the next deploy (it was unset, so a crash-looping deploy showed SUCCESS).
- Add a public domain (`railway domain`) once the web needs one.

**Web on Vercel** (phase 7): set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and API_URL=<Railway URL>. Add the
prod origin and `https://<domain>/api/auth/callback/google` to the Google OAuth client. `NEXT_PUBLIC_EXTENSION_URL`
(the Web Store page) is optional until the listing exists.

Deploy the backend first when a migration ships: 000002 adds `highlights.color`. Older extensions send no colour
and get yellow, so either order works, but the web shows colours only once the API returns them.

**Security review 2026-10-12** (AgentShield, govulncheck, npm audit, and a read of auth, sync, sharing and the
extension bridge):
- Backend: Go 1.26.9 (`go.mod`; Railway builds with it, as 1.25 gets no more fixes), chi v5.4.0, x/text v0.43.0.
  govulncheck now finds nothing.
- The client IP is the rightmost X-Forwarded-For entry (`ClientIPFromXFFTrustedProxies(1)`: Railway's edge is the
  one proxy). Rate limits key on the user only when the access token verifies, else on that IP, so made-up Bearer
  tokens or spoofed X-Forwarded-For no longer buy fresh buckets.
- Web: frame-ancestors none, X-Frame-Options DENY, nosniff, HSTS, a referrer and a permissions policy, and no
  X-Powered-By (`next.config.ts`).
- Extension: ignores untrusted (page-made) mouseups, so a page can't trigger auto-save.
- Left as is: the PostCSS advisories in Next 15's bundled copy (build time, on our own CSS; gone with Next 16), and
  saved passages being readable by the page through the CSS Highlight registry (the price of not touching its DOM).

## Known limits (marked with ponytail comments in the code)
- The extension store is one storage key, rewritten on every save. Split it per record if stores reach many MB.
- A first pull sends every live note in one response. Page it past tens of thousands of highlights.
- The web library (`GET /library`) also loads every note at once; same ceiling, same fix.
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
- Change leaves the old topic in place with no notes. Topic matching skips it and the web library hides it.
- Tabs that were open before the extension was installed or reloaded need a reload before they can save.
