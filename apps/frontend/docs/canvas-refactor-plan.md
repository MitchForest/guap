# Canvas + Flows Refactor Plan

## Current State Recap
- World coordinates live on each `CanvasNode.position` (pixels). Nodes render via CSS transforms inside a scaled container. Edge paths reuse these world coordinates but the SVG shifts its `viewBox`, causing the 200 px first-edge offset.
- Graph data is kept as flat arrays (`nodes`, `flows`, `rules`) with IDs cross-referenced in Solid store state. There is no hierarchy between nodes beyond naming, and flows have minimal metadata (`kind?: 'manual' | 'automation'`).
- Connection UX uses invisible hit areas: pressing the bottom "+" anchor enters connect mode, top anchors complete a link. A global escape cancels. Bottom dock offers generic “New” menu plus Zoom controls.
- Drawer surfaces balance + placeholder actions. Rule drawer mutates edges into “automation” but there is no clear distinction in the canvas.

## Target Goals
1. **Consistent geometry** – keep the SVG and nodes in the same world coordinate space so edges always attach to anchors, regardless of viewBox padding or zoom.
2. **Structured data model** – distinguish Income sources, Accounts, Sub-Accounts, and Flows. Support an explicit parent/child relationship for sub-accounts and richer flow metadata (label, amount, trigger type).
3. **Minimal, purposeful UI** – streamline creation into the three required actions, rename “rules/automations” to a teen-friendly word (proposal: `flow`), and tuck zoom controls into a floating widget away from the dock.
4. **Clear connection mode** – allow entry by global “Start Flow” action or the node’s hover "+" anchor; while active, clicking a source then a destination completes the flow and exits the mode automatically.
5. **Side drawer clarity** – selecting a node opens the drawer with balance, parent/child info, and its inbound/outbound flows described using the new naming.

## Architecture Decisions
### Geometry & Coordinate Helpers
- Keep the canvas container responsible for pan/zoom transforms, but expose `worldToViewport` and `viewportToWorld` helpers from `CanvasViewport` so other modules share the math.
- Keep `<EdgeLayer>`’s viewBox padding for drop shadows but counter the offset with a CSS translate so world coordinates align with node anchors.
- Export a `buildEdgeViewBox(nodes)` helper that returns consistent padding metadata reusable by other canvas utilities.

### Data Model
- Update `CanvasNode` type:
  ```ts
  export type CanvasNodeKind = 'income' | 'account' | 'subAccount';
  export type CanvasNodeCategory = 'checking' | 'savings' | 'brokerage' | 'creditCard' | 'other';
  export type CanvasNode = {
    id: string;
    kind: CanvasNodeKind;
    category?: CanvasNodeCategory;
    parentId?: string | null; // for sub-accounts linking to an account
    label: string;
    balance?: number;
    accent?: string;
    icon?: string;
    position: { x: number; y: number };
  };
  ```
- Replace `CanvasEdge` with `CanvasFlow`:
  ```ts
  export type CanvasFlow = {
    id: string;
    sourceId: string;
    targetId: string;
    tone: 'manual' | 'auto';
    tag?: string; // teen-facing label eg. "Boost"
    amountCents?: number;
  };
  ```
- Keep the observable arrays for ordering but derive indexed lookups (`nodeLookup`, `accountOptions`) via `createMemo` so hierarchy/navigation stays fast without complicating write logic.

### Connection UX State
- Represent flow composer state as a small finite-state machine: `'idle'`, `'pickSource'`, or `'pickTarget'` with the current draft payload stored while targeting.
- Node cards reuse existing anchor callbacks; clicking the global Flow button arms `'pickSource'`, clicking the plus anchor jumps straight to `'pickTarget'`.
- A floating “Flow” toggle button enters/exits mode; finishing a flow (selecting destination) immediately exits and resets selection.

### Creation Flow
- Replace the dock with three pill buttons: `Income`, `Account`, `Sub-account`, plus `Flow`. Accounts open a simplified chooser for {Checking, Savings, Brokerage, Credit Card, Other}. Sub-account creation prompts for name + parent selection when launched from dock (or context menu).
- Move zoom controls to bottom-right as a vertical cluster (`+`, `–`, reset tooltip) anchored relative to viewport container.

### Drawer Content
- Drawer shows: node summary (emoji/icon, label, balance), parent/children chips (planned), and inbound/outbound flow lists with tone + partner labels. CTA wording leans on the flows terminology.
- Ensure terminology uses “Flows” consistently. The existing rule drawer can be reworked/replaced in a later pass; for now, we gate automation-specific UI behind flows with `tone === 'auto'`.

## Implementation Sequence
1. Refactor coordinate helpers and EdgeLayer alignment (ensure parity with drag/zoom).
2. Migrate graph state to normalized structure and update dependent utilities (selection, duplication, persistence).
3. Rebuild connection mode & node card interactions to use the new `Flow` terminology and state machine.
4. Simplify creation UI + zoom controls; retire unused modals or merge them into the new prompts.
5. Refresh drawer layout/content to reflect flows and hierarchy.
6. Update tests/manual QA checklist (drag, connect, undo/redo, save/publish).
