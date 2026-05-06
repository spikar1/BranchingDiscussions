# BrandisAI — Product Requirements Document

**Status:** draft — product decisions locked where stated; §9 remains open until owners answer. **Implementation** is advancing locally; §10 summarizes current code gaps vs locked intent.  
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

The product supports **multiple named canvases** (distinct maps), not a single unbounded graph for all work. Each canvas has its **own node graph, undo/history scope, and export bundle**; switching canvas is an explicit user action. **Implementation today:** dropdown canvas picker plus create/rename plumbing in local storage; richer gallery or tabs remains **optional polish (TBD)**.

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
| **P0 — Prove interaction** | **BYOK mandatory from first usable P0 build:** users supply provider API credentials; no reliance on developer-hosted inference keys alone. Plus **multiple named canvases**, polished branching canvas, **Summarize selection** + **Combine selection**, **pinned snapshots**, **history UI** foundation **§6**.<br><br>**P0 note — inference:** Align all AI entry points (**explore**, **follow-ups**, **imagine**, **spark**) with **§2** / **§6** before widening beta; env-based `OPENAI_API_KEY` is acceptable only as a **dev fallback**, not as the sole production path for real users **§10**. |
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
- **Retry / regenerate / expand AI:** each **superseding model output** must append revision semantics **§4.4**. **Implementation today:** superseded outputs are retained on the QA node (**`answerRevisions`**) with UI recall, and timeline commands capture the supersession — aligned with locked intent pending broader history UI (**§10**).
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

**Foundation (still true)**

- **React Flow** canvas, **QANode** selection → branch, **image** and **note** nodes, **FloatingEdge**, **NodeSearch**, **Next API routes** for OpenAI (`explore`, `followups`, `imagine`, `spark`).
- **Domain fields** on QA payloads (`parentId`, `branchedFromId`, `branchedFromText`, `persistedMarks`) match the branching story.

**Implemented toward P0 (local-only)**

- **BYOK §2 / §5:** API routes resolve the OpenAI key from request header first; env `OPENAI_API_KEY` remains a **development fallback**. UI stores user key client-side (**browser local storage**) — sufficient for solo local use; **not** acceptable as the documented long-term server-side pattern once accounts exist **§6**.
- **`CanvasGraphCommand` + replay:** synchronous graph edits run through **`applyCanvasGraphCommand`** (`canvasGraphCommands.ts`); **`CanvasRevisionTimeline`** stores parent-linked immutable entries (`canvasRevisionTimeline.ts`). **Undo / redo:** toolbar + keyboard shorten the timeline pointer and replay from empty — **§4.4** direction.
- **Gesture batching:** node **position** and **dimensions** updates are **transient while drag/resize is in progress** and **commit on release** (so layout is undoable without per-frame churn).
- **Per-canvas persistence:** **`brandis-canvas-registry-v1`** registry plus **`brandis-canvas-doc-v1:<canvasId>`** documents in `localStorage`; legacy single-key snapshot migrates on first load (`persistence.ts`).
- **Product vs view types:** `*ProductPayload` types separate domain fields from React Flow **position / optional width** (`types/canvas.ts`) — export/history spine **§4.4**.
- **Retry / expand:** new model output is applied via **`supersede-qa-model-output`**; prior output is appended to **`answerRevisions`** on the node and surfaced in the QA UI — no silent discard of superseded text.

**Still missing or partial vs locked P0**

- **Summarize selection** and **Combine selection** (**§4.2–4.3**): **not shipped** yet (toolbar actions, synthesized node kinds, pinned combine semantics).
- **History / provenance UI beyond undo:** no **global timeline** or combine **“show sources”** surface yet; lineage is reconstructable from the timeline payload but not productized for users **§4.3–4.4**.
- **Lossless export/import per canvas (P1 roadmap):** not yet a bundled format carrying the revision log from the snapshot store (**§5** Phase 2).
- **`useCanvasGraph`:** command/timeline cores exist, but this hook remains the **Orchestration monolith** (async AI + graph + persistence). Expect further extraction for tests, multiplayer sync (**P2**), and hardened mutation coverage.
- **Indexed / durable storage:** still **`localStorage`** only — sufficient for prototypes; revisit **IDB** or server store before large canvases or sync **§6**.

**Refactor / replace before “sync at scale”**

- **ASP.NET backend:** disconnected from frontend; archive or delete when consolidating stack unless resurrected deliberately.
- **Harden** delete semantics for export (**tombstone vs destructive** **§7**) once import/export ships.
