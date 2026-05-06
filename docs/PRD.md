# BrandisAI — Product Requirements Document

**Status:** draft — decisions locked from product conversation; open items need owner answers.  
**Working name:** BrandisAI (may change). Repository folder name may differ.

---

## 1. Goal

Help people **explore many facets of an idea** without losing threads. Linear chat buries follow-ups in **walls of text** and forces mental stack-juggling; users reread, forget paths, and waste attention. BrandisAI presents exploration as a **spatial graph**: branch from answers **at the phrase or concept** you care about, keep parallel threads visible, and optionally **compress** or **synthesize** structure while **preserving lineage** for reference and undo.

**Success for the user:** a **clear mental model** of the topic and a **trustworthy map** they can revisit—enlightenment plus reference, not just information hoarding.

---

## 2. Product principles

- **Branching-first:** selection-based branching into new Q&A nodes is the spine; everything else ladders off it.
- **Optional scaffolding:** quizzes and nudges exist but are **never forced**.
- **Provenance beats vibes:** synthesized or collapsed views must remain **explainable via UI** (history, sources), not conversational guesswork.
- **Faithful export first:** backups are **lossless replay** (structured format); human-readable summaries are layered later.
- **Thin node shells:** new node kinds are typed payload + renderer + edges + shared pipelines (history, export); avoid special snowflakes until needed.
- **Bring-your-own-key:** users supply credentials for AI providers **(product decision)**; no requirement for developer-funded inference in early phases.
- **Account-first eventually:** canonical state belongs to authenticated users **after** the novel interaction is validated locally.
- **Private by default:** the primary experience is a **personal, intimate** space for learning and exploration; anything social is **opt-in** and must not erode that feeling.

## 3. Primary user & primary job

**User:** learner / curious explorer (solo first).

**Job:** drill into **one topic**, follow **multiple interesting threads**, return to overview without rereading everything; end with understanding and something worth reopening months later.

---

## 4. Core interactions

### 4.0 Canvases (projects)

The product supports **multiple named canvases** (distinct maps), not a single unbounded graph for all work. Each canvas has its **own node graph, undo/history scope, and export bundle**; switching canvas is an explicit user action (**implementation:** gallery / picker / tabs **TBD**).

### 4.1 Branch from answer (existing, must-have)

User selects text in an answer → creates a linked child Q&A node with context (`markedText`, parent Q/A). Manual edges and pane placement complement but do not replace this.

### 4.2 Summarize many inputs (planned)

User **multi-selects** nodes (e.g. shift or marquee), then **Summarize selection** (dedicated toolbar button, distinct from combine). Creates a **new node** with **explicit references** to all inputs. **Input nodes stay visible** on the map (hub-and-spoke research pattern).

### 4.3 Combine / synthesize (planned)

User selects nodes, then **Combine selection** (second dedicated toolbar button). Produces **one surfaced node** that is a **first-class living node** (can be revised like any other). **Prior inputs are hidden** from the default view but **recoverable** via **version history / “show sources”** UI. **Content used at combine time is pinned** (snapshot semantics): later edits to upstream nodes do not silently rewrite the combined node’s basis.

### 4.4 Graph history & undo

- **Designed from day one:** not an afterthought for combine alone.
- **UI undo/redo (e.g. Cmd+Z):** time travel across actions.
- **Data model direction:** immutable **revision records** with **stable ids** and **parent references** (git-like mental model); new revisions get new ids where needed; lineage supports synthesis and replay.
- **Position:** every **position change** produces a **persistent history entry** (layout is undoable / replayable faithfully).
- **Size:** resizing is **optional**; when no explicit dimensions are recorded, geometry falls back to a **deterministic default** (rule defined per node type / schema version). **Whenever the user explicitly resizes**, that change **records history** (**§4.4** revision default).
- **P0 revision default:** **Everything that meaningfully mutates canvased content** (**position**, **explicit size**, **title**, **note body**, **`retry` / `expand` / other AI supersessions of answers**, structural ops like **combine** / **summarize**, **create/delete node**, **`edge add` / `edge remove`** via manual connect/disconnect **or** system-created edges) produces a **new revision entry** recoverable via undo/time travel. **Intent:** avoid silent overwrite; **allow refactoring** later if storage or UX becomes painful.
### 4.5 Quiz (later, low MVP priority)

- **Default:** questions **only** from content present in the user’s graph (closed-book over the map).
- **Explicit opt-in mode:** broader “map my understanding of the topic” may draw from outside the map.

### 4.6 Listify (TBD)

Possible: turn a dense answer into a structured list node while preserving prior revision in history. **Not required for early MVP.**

### 4.7 Share (future, optional)

- **Out of scope:** **collaborative editing** (multiple people mutating one canvas). **Not expected to fit the product.**
- **May ship later:** **view-only link** to a canvas or **published snapshot**, created **explicitly by the owner**—useful for showing a line of thought without inviting co-editing. Details **TBD** (live vs snapshot, expiry, revoke, identity **TBD**).
- **Posture:** sharing must stay **optional**; the default remains **safe and intimate**.

---

## 5. Phased roadmap

| Phase | Focus |
|-------|--------|
| **P0 — Prove interaction** | **Multiple named canvases** + polished branching canvas; **Summarize selection** + **Combine selection**, with **pinned snapshots** + **history UI** foundation. |
| **P1 — Persistence & export** | Faithful **JSON (or similar) export/import** **per canvas**; revision log travels with canvas bundle; optional **bulk export** (**TBD**). |
| **P2 — Accounts & sync** | Auth, server store, multi-device; **optional** local snapshot still supported. **Optional:** **view-only share links** (owner-minted), **no** co-editing. |
| **P3 — Quiz & extensions** | Map-grounded quiz; later open-world quiz option; additional node types as thin shells. |

**Deprioritize / exclude:** replacing linear chat for all use cases. **Collaborative real-time editing** on a shared canvas is **out of product scope** **§4.7**.

---

## 6. Architecture direction (product-level)

- **Single application stack** for the product backend is preferred; the separate **ASP.NET** project in this repo was an exploratory choice and is **not** assumed to be the long-term owner of graph state.
- **Next.js** as web app + **server-side AI** (API routes) aligns with current code; canonical store TBD (see open items).
- **BYOK:** Prefer **proxied API routes** with the **user-supplied key** per session or per request **(implementation guidance)** — avoid shipping provider secrets in client bundles or logs. At account sync (**P2**), keys may migrate to **per-user encrypted server storage** (**TBD**). **Current posture:** developer does **not** aim to warehouse user canvases or content on infra during the passion-local phase (**§9**, compliance deferral bullet, revisits this before scaling).

---

## 7. Data & edge cases

- **Delete node:** today removes node and incident edges; with history, define whether delete is **tombstone** or **destructive** in exported bundles.
- **Retry / regenerate / expand AI:** each **superseding model output** appends a **revision** (no silent overwrite of prior answer text in the history model **§4.4**). **Current code** still replaces in place — **implementation gap §10**.
- **Expand answer:** same rule as retry (longer replacement = new revision).
- **Offline / quota / model errors:** graceful degradation, visible failure state (partially present).
- **Large graphs:** performance, minimap, search (Node search exists); export size limits.

---

## 8. Non-goals (current)

- **Real-time collaborative editing** of a shared canvas **§4.7**.
- Being the **default** replacement for every ChatGPT-style thread.
- **Forced** quizzes or pedagogical nagging.
- **Hiding provenance** without a UI path back.
- **Human-readable-only** export as the first shipped backup format.

---

## 9. Open decisions (need answers)

Track owner decisions here; remove bullets as they close.

1. **Go-to-market:** **Passion / personal build for now** with intent to expand and scale later — **direction TBD** (solo SaaS vs teams vs enterprise affects auth, billing, moderation when that phase arrives).
2. **AI providers & models:** beyond BYOK itself — OpenAI-only vs multi-provider; **allowed models** list (**TBD**). Optional future **hosted-inference fallback** for paying customers (**TBD**).
3. **Share links (policy decided; mechanics TBD):** **View-only links** may exist later; **collaborative editing** does not. Open: **snapshot vs live read**, **link expiry/revocation**, **access gating** (anonymous vs account **TBD**).
4. **Compliance / privacy (defer):** Until the product **persists substantive user-owned state on servers** beyond **proxied inference with BYOK keys** (today: **minimal data held by developer** **§6**), **formal GDPR-style retention, delete-account workflows,** and extended legal posture are **explicitly deferred**. Revisit **before public SaaS**, multi-tenant hosted state, or any non-BYOK data collection.

---

## 10. Current implementation notes (engineering)

**Keep as foundation**

- **React Flow** canvas, **QANode** selection → branch, **image** and **note** nodes, **FloatingEdge**, **NodeSearch**, **Next API routes** for OpenAI (`explore`, `followups`, `imagine`, `spark`). Routes currently use env `OPENAI_API_KEY`; **BYOK wiring** remains to align with product decision **§2**.
- **Domain fields** in `QANodeData` (`parentId`, `branchedFromId`, `branchedFromText`, `persistedMarks`) match the product story.

**Refactor / replace before “history + sync” land**

- **`useCanvasGraph`:** large hook mixing UI state, async AI, and graph ops — should gain a **reducer or command layer** so every mutation is **loggable** for undo and server sync. **Today** many updates **mutate node data in place** (e.g. `retry`, `expand`); product requires **revision append** per **§4.4**.
- **Persistence:** `localStorage` holds **one snapshot key** today; product requires **indexed storage keyed by canvas id** (or equivalent) plus **named canvas registry**. Replace with **event-sourced or explicit revision store** per canvas while rendering through React Flow.
- **ASP.NET backend:** disconnected from frontend; archive or delete when consolidating stack unless resurrected deliberately.
- **Types:** unify **product node model** vs **React Flow view state** (`position`, `width`) for clean export/schema versioning. **Position** is always material for history; **width/height** optional with schema defaults.
