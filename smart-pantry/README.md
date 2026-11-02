# 🥕 Smart Pantry

A shared household kitchen app: one live inventory for everyone at home, plus a personal AI chef
(Claude) that suggests recipes from **what you actually have**, **what's about to expire**, and
**what each of you has rated highly**.

> Status: **MVP (Phase 1) complete.** See the [roadmap](#roadmap) for what's next.

---

## 1. Requirements analysis — what really matters

| Requirement | What it implies |
|---|---|
| "Never ask each other if we still have milk" | One shared source of truth per household, realtime sync, and updating stock has to be fast enough that people actually do it |
| Inventory accuracy | All quantity changes are deterministic server-side transactions. The AI never does inventory arithmetic |
| Personal chef that learns | Explicit, explainable preference model built from ratings, which users can correct, sent to Claude as a summary |
| Food waste | Expiry is a core part of the data model (use-by vs best-before, opened date, freezing) and is part of every prompt |
| Two people, two phones | Per-user auth, household-scoped data, row-level security, optimistic concurrency, audit log |

**Product call:** the biggest risk to the app is that people **stop updating the inventory**, not
that the AI gives poor answers. That is why every inventory row has one-tap `−100 ml / −250 ml / All`
buttons. Adding items can be done by typing, voice, barcode, photo or receipt, and everything goes
through a review list before it is saved. "I cooked this" deducts all ingredients in one confirmation.

## 2. Architecture

```
 Phone A ─┐                                 ┌─────────── Supabase ───────────┐
 Phone B ─┼─ Next.js (React, mobile-first) ─┤ Postgres + RLS (household_id)  │
          │    • realtime subscription ◄────┤ Realtime (postgres_changes)    │
          │    • RPC calls (atomic ops) ───►│ RPC functions (SECURITY DEFINER│
          │                                 │   row locks + version check +  │
          │  Next.js API routes (server) ──►│   audit events in one tx)      │
          │    /api/ai/suggest  /api/ai/scan│ Auth (email/password)          │
          │    /api/barcode/:code           └────────────────────────────────┘
          │        │
          │        └──► Claude API  (key lives only on the server)
          │        └──► Open Food Facts (barcodes), Unsplash (optional photos)
```

* **Frontend:** Next.js 15 App Router, React 19 and Tailwind. It installs as a PWA on the home screen.
* **Deterministic domain layer** (`src/lib/domain`): unit conversion, name matching, expiry buckets, recipe↔stock matching with earliest-expiry-first allocation, shopping-list diffing and preference learning. These are pure functions with unit tests, and the browser and the server use the same code.
* **Database is the source of truth.** Quantity changes only go through Postgres functions:
  `adjust_inventory`, `set_inventory_quantity`, `discard_inventory`, `move_inventory`,
  `cook_recipe`, `add_shopping_item` and `purchase_shopping_item`. Each one locks the row, checks it and writes an
  `inventory_events` audit row (who, before, after, delta, reason) in the same transaction.
* **Concurrency:** every item has a `version`. Clients send the version they saw. A stale write
  raises `version_conflict`, so the app refreshes instead of silently overwriting a partner's change. Deltas
  ("use 200 g") are applied relative to the locked row, so two simultaneous "use 100 ml" taps both count.
* **Realtime:** one channel per household, filtered by `household_id`. Supabase applies RLS to realtime
  too. The app resyncs after a reconnect and when the tab regains focus, so missed events can't cause drift.
* **Nothing is hard-deleted.** Finished items keep `status = consumed / spoiled / discarded` for history and
  waste statistics.

### Why Supabase / PostgreSQL
I took up your Supabase suggestion. It fits well: you get relational integrity, which inventory, recipes and ratings need,
plus row-level security for household isolation, built-in auth and realtime. Transactional
functions also come at no extra cost. Firebase would make atomic multi-item deductions and relational queries harder. A custom
backend would mean rebuilding auth and realtime yourself. The free tier is enough for a household.

## 3. Claude integration

* **Server-only.** `ANTHROPIC_API_KEY` is read in `src/lib/ai/claude.ts`, which is marked `server-only`. The browser
  calls `/api/ai/*`, and those routes first check that the caller belongs to a household.
* **Fresh context per request.** `/api/ai/suggest` reads the current inventory, ratings and overrides from the DB
  on every call, so a change your partner made a second ago is included. `buildAiContext` sends only:
  active stock (name, quantity, unit, days left, date type, opened), per-person *summarised* tastes
  (loves, likes, dislikes, never, allergies, top-rated and rejected dishes), and recent meals. Raw history is not sent.
* **Structured output.** Claude must call a `submit_recipes` tool with a JSON schema. The result
  is validated with Zod. The default answer is three recipes: **favourite / practical (use it up) / discovery**.
* **Claude suggests, code decides.** Whatever Claude says, the "have / partial / to buy / check" status of every
  ingredient is recomputed deterministically against the live inventory. When units can't be compared
  (e.g. "1 bag" vs "200 g") the result is **check**, never "have".
* **Vision:** photo and receipt scans use Claude vision with a forced tool schema. Images are downscaled in the
  browser to at most 1568 px. Results always go to a review list, and low-confidence items are highlighted.
* **Prompt caching** on the static system prompt. Model is configurable via `CLAUDE_MODEL`.

### Preference learning (explainable, correctable)
Ratings map to signals (5 → +2, 4 → +1, 3 → 0, 2 → −1, 1 → −2) and are attributed to the recipe's main
ingredients, cuisine and methods. Only the latest rating per person per recipe counts. Scores are shrunk towards neutral,
so **a "dislike" needs evidence from at least two different recipes**. One bad dinner never bans mushrooms.
Users can override any learned stance (love / like / neutral / dislike / never) on the Preferences page,
and overrides always win. Ratings are stored per person. The chef sees each person's tastes plus
whether the household agrees on a recipe (both love it / split / neither likes it).

### Food safety
Use-by (safety) and best-before (quality) are separate fields with separate wording. Opened products
use `min(printed date, opened + days_after_opening)`. The app and the prompt never claim food is safe because of
a date. Past-use-by items trigger a "don't eat" warning, and moving an item to the freezer offers a new date.

## 4. Limitations & costs

* **AI costs** (rough): a suggestion call is about 2–4k input tokens plus 2–4k output tokens. With a Sonnet-class model that's
  roughly €0.02–0.06 per request, and a photo or receipt scan costs about the same. Daily use by two people should stay well under €5 a month.
  Inventory changes, matching, expiry and shopping make **no** AI calls.
* AI cost estimates, nutrition and shelf-life suggestions are **estimates** and are labelled as such.
* Barcode camera scanning uses the browser `BarcodeDetector` (Chrome or Android). Other browsers can type the number.
  Voice input uses the Web Speech API (Chrome, Safari).
* Name matching is heuristic (normalisation, plurals, synonyms). Unusual product names may need
  renaming, and when unsure the app says "check" rather than guessing.
* Recipe photos need an optional `UNSPLASH_ACCESS_KEY`. Without it, illustrated placeholders are shown.
* Push notifications are not in the MVP. Expiry alerts show on the dashboard (see roadmap).

## Smart restock suggestions
The shopping list has a **"Suggested for you"** card (also shown on the dashboard). It's computed deterministically in
`src/lib/domain/restock.ts`, with no AI cost:
* **Products you use regularly.** From the consumption log, the app works out how fast you use each product. If what's
  left lasts less than 7 days, it suggests about 1½ weeks' worth ("~4 days left at your usual pace").
* **Ingredients of recipes you cook often** (2× or more) that are missing or low.
* **Items below a low-stock alert level** you set on the product.
Anything already on the open shopping list is skipped. Amounts are rounded to shop-friendly sizes.

## Stores
Add the shops you use in **Settings → Our stores** (e.g. two supermarkets). After that:
* Every product and shopping item can be tagged with a store. The app remembers where you last bought each product
  and uses that as the default next time (`src/lib/domain/stores.ts`).
* The shopping list has a tab per store, so in the shop you only see what you need there. Tap an item's store tag
  to move it to the other shop. Suggestions show your usual store.
* "Bought → into inventory" records the store. Receipt scans detect the shop name automatically.
* Database: `supabase/migrations/0002_stores.sql` (run it after `0001`).

## Grocery-list photos
**Add → Photo / list → Grocery list** reads a photo of a handwritten or printed list, or a screenshot from a notes or
chat app, and turns each line into a product. You can pick several photos at once. Everything appears in the review
list (unsure lines are highlighted), you pick the store once, and then it's added to the stock.
On Android, you can also **share** photos from the gallery or WhatsApp to *Smart Pantry* (installed as an app from Chrome).
The add screen opens with the photos ready.

## Android app
* **Native APK (Capacitor):** `android/` is a native Android project that opens your deployed app full-screen,
  with camera and microphone permissions, a splash screen and a green status bar. The server is still needed so the Claude key stays secret.
  ```bash
  APP_URL=https://your-deployment.vercel.app npx cap sync android
  npx cap open android          # Android Studio → Run, or: cd android && ./gradlew assembleDebug
  ```
  The GitHub workflow `.github/workflows/smart-pantry-android.yml` builds a debug APK as a downloadable artifact
  (run it manually and enter the URL, or set the repo variable `SMART_PANTRY_URL`).
* **Or install as a PWA:** open the site in Chrome on Android and choose ⋮ → *Install app*. There's a manifest, icons and an offline page.
* Sharing photos *to* the app uses the PWA share target, so it works when installed from Chrome. The Capacitor
  APK does not register as a share target yet.
* Voice dictation uses the Web Speech API, which Chrome supports but the in-app WebView does not. In the APK, use the
  keyboard's microphone button instead. Photo and receipt scans and the barcode camera work in both.

## Mockups
Real screens rendered at Android phone size (Pixel 8) from the demo build are in `docs/mockups/`.
Run the demo yourself without a backend: `NEXT_PUBLIC_DEMO=1 npm run build && NEXT_PUBLIC_DEMO=1 npm start`.

## 5. Setup

```bash
cd smart-pantry
npm install
cp .env.example .env.local         # fill in Supabase URL / anon key and ANTHROPIC_API_KEY
# In the Supabase dashboard → SQL editor, run supabase/migrations/0001_init.sql
#   (or: supabase db push with the Supabase CLI)
npm run dev                         # http://localhost:3000
```
Deploy to Vercel (or any Node host) and set the same environment variables. Never give
`ANTHROPIC_API_KEY` a `NEXT_PUBLIC_` prefix.

Household: one person signs up and creates a household. In **Settings → Invite your partner** they share the link or code,
and the other person signs up and joins. From then on both phones see the same kitchen live.

### Tests
```bash
npm test          # domain logic: units, expiry, matching/FEFO, shopping diff, preference learning, parser
npm run test:db   # real Postgres: RLS isolation, concurrency conflicts, atomic cooking deduction,
                  # separate ratings, shopping de-dup, idempotent purchase (needs local Postgres, run as non-root)
npm run lint      # TypeScript strict type-check
```

## Roadmap

**Phase 1 – MVP ✅ (this release)**
Auth and households with invite codes · realtime shared inventory (fridge, freezer, pantry, other) · one-tap consumption ·
type, voice, barcode, photo and receipt add with review · move, spoil, discard and correct, with full audit log ·
expiry dashboard (today, ≤2, ≤5, ≤7 days, fresh) with use-by vs best-before handling · Claude recipe trio · deterministic
have/buy split · "I cooked this" with adjustable atomic deduction · per-person ratings · learned and correctable
preferences · shared shopping list with de-dup, low-stock suggestions and "bought → into inventory".

**Phase 2 – habits & waste (highest value next)**
1. Web push / email digest for items expiring tomorrow (Supabase cron + Edge Function).
2. Weekly meal planner that allocates expiring stock across days (deterministic allocation, Claude for dishes).
3. Waste and savings statistics (data is already in `inventory_events`).
4. "Freeze it before it goes bad" suggestions and per-product default shelf-life memory.

**Phase 3 – depth**
Nutrition targets · grocery budget tracking from receipt prices · seasonal produce hints · cuisine
exploration stats · offline queue for supermarket dead zones · multiple households per user.

Deliberately postponed: these add complexity without improving the core loop (know what we have → cook → update).
