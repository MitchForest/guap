# Scenario System Blueprint

## Product Vision
- Empower teens to stress-test their saved money maps by layering narrative “what if?” lenses onto their existing plan.
- Preserve the baseline workspace as the source of truth; scenarios read from it, project forward, and only mutate it when the user explicitly applies the changes.
- Turn complex financial trade-offs into approachable stories with immediate, visual feedback across cash flow, goals, and wealth milestones.

## Experience Principles
- **Clarity first**: every scenario states its assumptions, duration, and the nodes/allocations it touches before it runs.
- **Guard user agency**: nothing writes back to the base graph without consent; toggling a scenario on/off reverts the canvas to baseline.
- **Low cognitive load**: keep the core canvas visible, highlight only the deltas, and surface comparisons side-by-side instead of forcing mental math.
- **Fast iteration loops**: scenario parameters update simulations in-line with minimal latency; no modal confirmations after initial setup.
- **Progressive disclosure**: advanced knobs (interest compounding changes, custom payoff strategies) only appear behind “Advanced settings” once users master the basics.

## Information Architecture
- **Scenario Hub (left dock tab)**  
  - Sections: Library (team-curated templates), My Scenarios (user-saved), Active Scenario (currently applied lens).  
  - Inline save guard that mirrors `hasChanges()` from `apps/frontend/src/routes/CanvasPage.tsx:314`; blocks launch when unsaved edits exist.
- **Scenario Builder (right-side panel)**  
  - Step 1: Template overview (narrative, assumptions, suggested defaults).  
  - Step 2: Parameter tuning (sliders, dropdowns, toggles).  
  - Step 3: Impact preview (list of node additions, allocation deltas, inflow/outflow adjustments).  
  - Footer actions: `Run simulation`, `Bookmark scenario`, `Discard`.
- **Scenario Overlay (canvas layer)**  
  - Nodes touched by the scenario adopt an accent outline/glow; new nodes display a “scenario” badge.  
  - Edge rule changes show dotted connectors with tooltips summarising new flows.
- **Comparison Drawer (bottom dock)**  
  - Tabs: Overview (key deltas), Cashflow chart, Wealth ladder, Goals, Accounts table.  
  - Always shows Baseline vs Scenario metrics, plus callouts for the biggest changes.

## Core User Flow
1. User finishes tweaking their plan and saves (or is prompted to save before continuing).
2. In Scenario Hub, user selects a template; Builder opens with story-driven copy and defaults.
3. User tunes parameters; impact preview updates instantly, highlighting impacted nodes and rules.
4. User runs the simulation; bottom dock renders dual-series charts and milestone deltas.
5. Optional: user bookmarks the parameter set for later, shares it (future), or applies the diff to baseline (creating a new dirty state).
6. User can deactivate the scenario at any time to snap back to baseline visuals.

## Scenario Template Library (Initial Set)
- **Allowance Negotiation**  
  - Applies a recurring percentage raise to selected inflow nodes annually.  
  - Parameters: raise %, cadence (annual/semester), duration (years), success cap.  
  - Preview: updated inflow rule, optional new “Negotiation fund” goal (stretch idea).
- **Student Loan (200k prototype)**  
  - Adds loan liability node with principal, interest rate, grace period, repayment rule pulling from chosen bucket.  
  - Parameters: principal, APR, term, grace period, repayment autopay amount.  
  - Flags total interest paid, payoff date vs horizon, and emergency fund impacts.
- **Credit Card Car Purchase**  
  - Creates credit card liability with $15k purchase, autopay minimum %, calculates compounding interest.  
  - Optional parameter to simulate occasional lump-sum payments.  
  - Highlights payoff timeline and cumulative interest vs baseline.
- **Payday Advance Loop**  
  - Adds monthly short-term loan tied to allowance node; includes fees and repayment within same or subsequent period.  
  - Parameters: advance amount, fee %, repayment lag, failure consequences (optional).
- **Custom Free-Form**  
  - Builder wizard lets users stack actions: add income, add expense, adjust allocation weights, add/remove goals.  
  - Stores the diff as a bespoke scenario for replay.

## Data & State Model
- **ScenarioDefinition**  
  ```ts
  type ScenarioDefinition = {
    id: string;
    title: string;
    description: string;
    parameters: Record<string, ScenarioParameter>;
    diff: ScenarioDiffGenerator;
    defaultHorizonYears?: number;
    category: 'income' | 'debt' | 'expense' | 'custom';
  };
  ```
- **ScenarioParameter**  
  - Metadata for UI (label, type, bounds, units, helper text).  
  - Supports basic types (number, percent, select, duration) and advanced toggles hidden by default.
- **ScenarioDiff**  
  ```ts
  type ScenarioDiff = {
    nodesToAdd: CanvasNode[];
    nodeOverrides: Record<string, Partial<CanvasNode>>;
    ruleChanges: Array<{ sourceNodeId: string; allocations: RuleAllocationRecord[] }>;
    annotations: ScenarioAnnotation[];
  };
  ```
- Diffs are generated from baseline graph and parameter values. They live in scenario-specific store, not merged into baseline until user applies.
- Persist scenario templates locally (JSON) and later via Convex; user-saved scenarios stored with workspace slug key.

## Simulation Integration
- Reuse `simulateGraph` (`apps/frontend/src/utils/simulation.ts`) by building patched node/rule arrays: baseline graph + scenario diff results.
- Maintain two simulation runs in memory: baseline (cached from last save) and scenario (recomputed on parameter change).  
- Debounce recomputation when parameters change rapidly; consider worker thread if performance dips over long horizons.
- Horizon defaults to baseline setting unless scenario overrides (e.g., long-term debt).

## Visualization Model
- **Charts**: dual-line totals with shaded delta area, monthly tooltips (“Scenario +$320 vs baseline”).  
- **Milestones**: cards show baseline month vs scenario month; tags for accelerated/delayed.  
- **Goals**: grid of goal cards with status chips (on track, delayed, unattainable) and delta in completion month.  
- **Account Table**: sortable table listing ending balances, interest paid/earned, with color-coded variance.  
- **Callouts**: highlight top 3 insights (“Emergency fund hits target 10 months sooner,” “Total interest paid +$12,400”).

## Safeguards & UX Guards
- Block scenario launch when `hasChanges()` is true (unsaved work); show modal with “Save first” CTA.
- Warn when scenario tries to adjust nodes missing allocation coverage; reuse `allocationIssues()` guard.  
- Clear scenario state on workspace switch (leveraging `WORKSPACE_STORAGE_KEY`) to avoid cross-workspace bleed.
- Provide “Reset parameters” and “Remove scenario” actions per template.
- If user applies scenario to baseline, trigger toast summarising applied changes and mark workspace as dirty for potential undo via history.

## Technical Dependencies
- Extend canvas renderer to support scenario overlays without breaking drag/select interactions (`CanvasViewport`, `CanvasNode` components).  
- Update bottom dock store/state to ingest dual simulation datasets and render comparison UI.  
- Add scenario store (Solid signal/store) with derived patch graph and metadata.  
- Future: integrate Convex for syncing scenario definitions per user/workspace.

## Open Questions
- Do we need multi-scenario stacking (running two scenarios simultaneously) or is single active scenario sufficient for MVP?  
- How do we handle conflicting diffs (e.g., two scenarios editing the same rule) if stacking becomes a requirement?  
- Should we cache scenario simulation results per parameter hash to speed up revisiting old configurations?  
- What educator content pipeline is needed to author and QA templates at scale?

## Milestones & Next Steps
1. **Wireframe & Copy**: design Scenario Hub, Builder, overlay, and comparison states (desktop/tablet).  
2. **Data Modeling Spike**: align on `ScenarioDefinition` + diff schema with engineering; build TypeScript interfaces.  
3. **Prototype Template**: implement student loan scenario end-to-end in a feature branch to validate architecture and UI copy.  
4. **Usability Testing**: run moderated sessions with teens/educators to confirm comprehension and motivational impact.  
5. **Polish & Rollout**: refine visual treatments, add telemetry, prepare release notes and educational guidance.
