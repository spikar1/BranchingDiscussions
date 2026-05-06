# PRD task graph (compact)

Source: `docs/PRD.md`. Use **one ID per PR/session** where possible.

## Rolling engineering snapshot

Indicative only; **`docs/PRD.md` section 10** is the narrative source of truth.

- **Shipped locally (prototype):** A (product vs RF types), B (command apply), C (per-canvas `localStorage` + registry + legacy migrate), D (timeline entries + replay), E (undo/redo UI + shortcuts), F (retry/expand retain prior output + timeline), G (layout commits on drag/resize end), H (dropdown picker + new canvas), **I (Summarize selection — multi-select, new QA node, source edges, `/api/summarize`)**, L (BYOK header on API routes + settings UI; env key dev fallback).
- **Still open for P0:** J (Combine), K (provenance / global history UI beyond per-node QA revisions). P1: M, N. **D2** still refines provider policy after baseline OpenAI BYOK.

## Owner decisions (§9 — do not implement without answers)

| ID | Topic |
|----|--------|
| D1 | Go-to-market / scale posture |
| D2 | AI providers & allowed models; optional hosted inference |
| D3 | Share links: snapshot vs live read, expiry, revocation, gating |
| D4 | Compliance / privacy before server-persisted multi-tenant SaaS |

---

## P0 — Prove interaction

**Inference (§5):** **BYOK is mandatory** from the first usable P0 build—no production path that relies **only** on developer-hosted keys. Align **`explore`**, **`followups`**, **`imagine`**, **`spark`**, **`summarize`** with §2 / §6 before widening beta. Env **`OPENAI_API_KEY`** = **dev fallback only**, not the sole real-user path (§10).

| ID | Task | Depends on |
|----|------|------------|
| A | Split **product node model** vs **React Flow view** (position, explicit size, title, body typed for export + history) | — |
| B | **Command/reducer** for all graph mutations (replace ad-hoc `useCanvasGraph` patches) | A |
| C | **Per-canvas store**: named canvas registry + storage keyed by `canvasId` (replace single snapshot) | A |
| D | **Immutable revision log** (stable ids, parent refs); §4.4 P0 mutations → new revision | B |
| E | Cmd+Z / redo on revision timeline | D |
| F | **Retry / expand / regenerate**: append revision, not in-place replace (§10 gap) | D |
| G | **Layout**: position + explicit resize → revision | D |
| H | Canvas **switch UI** (gallery / tabs / picker — UX TBD) | C |
| I | **Summarize selection**: multi-select → new node + input refs; inputs stay visible — **shipped** (§10) | B, D |
| J | **Combine selection**: one living node; inputs hidden default; pinned snapshot; show sources | I, D |
| K | **History / provenance UI** (revisions, sources for combine) | J, E |
| L | **BYOK (P0 blocker):** user-supplied key on **all** AI entry points above (incl. **`summarize`**), via **proxied** API routes; keys not in client bundle/logs. **D2** later refines multi-provider + allowed-model list | — |

**Parallel tracks after A:** core graph `B→D→E,F,G,I→J→K` (**I** shipped §10) · multi-canvas `C→H` · **L in parallel (P0 gate for real users/beta)** · **D2** extends provider/model policy after baseline BYOK.

---

## P1 — Persistence & export

| ID | Task | Depends on |
|----|------|------------|
| M | Lossless **export/import per canvas**; revision log in bundle | A, C, D |
| N | **Delete semantics** (tombstone vs destructive §7); export behavior | D |

---

## P2 — Accounts & sync

| ID | Task | Depends on |
|----|------|------------|
| O | Auth + server canonical store + multi-device | M (helps schema stability) |
| P | Optional **local snapshot** still supported | O |
| Q | **View-only share** (owner-minted); **no** co-editing §4.7 | O, **D3** |

---

## P3 — Later

| ID | Task | Depends on |
|----|------|------------|
| R | Quiz (map-grounded default) | stable graph + revisions |
| S | Listify (TBD §4.6) | — |
| T | ASP.NET cleanup if stack stays Next-only §6 | — |

---

## Dependency sketch

```
A → B → D → E, F, G, I → J → K   (I shipped — Summarize §10)
C → H
L  (P0 gate: real users need user key path on all routes; env key dev-only §5)
D2 (extends/refines L: providers + allowlist §9)
M ← A, C, D
O ← M (soft)    Q ← O, D3
```

---

## Revision default (§4.4 P0)

Everything that materially mutates canvased content should emit a recoverable revision: position, explicit size, title, note body, AI supersessions, combine/summarize, create/delete node, edge add/remove (manual or system).
