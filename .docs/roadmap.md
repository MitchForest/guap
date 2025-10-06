# Sequence Canvas Parity Roadmap

This roadmap expands on `plan.md` and tracks everything needed to reach UI/UX parity with the Sequence reference screens (`.docs/get-sequence-screenshots`). Each checklist item maps to Solid + Tailwind frontend work or Convex backend support.

## 1. Canvas Core
- [ ] Pan & zoom (with inertia + reset)
- [ ] Zoom indicator + keyboard shortcuts (`⌘/Ctrl +` / `⌘/Ctrl -`)
- [ ] Grid background + snap-to-grid toggle
- [ ] Node selection (single, multi with drag marquee + shift-click)
- [ ] Node dragging with collision-free movement, snap-to-grid
- [ ] Edge preview while dragging from anchors
- [ ] Auto-scroll when dragging near viewport boundary
- [ ] Undo/redo stack for viewport + node/edge adjustments

## 2. Node Management
- [ ] Node card styling variants (income, account, pod, goal, liability)
- [ ] Status adornments (rule chips, warning badges)
- [ ] Inline rename + quick balance edit
- [ ] Node drawers (`pod-drawer.png`) showing metadata and actions
- [ ] Context menu (duplicate, delete, lock position)
- [ ] Drag-to-select multi nodes; align and distribute commands

## 3. Edge & Automation Layer
- [ ] Edge rendering with overlap avoidance + hover highlight
- [ ] Edge context popover (view rule summary, delete)
- [ ] Rule chips attached to edges/nodes with counts
- [ ] Dashed connector preview while building edges
- [ ] Linked edge removal confirmation when rule attached

## 4. Creation Flows
- [ ] Empty canvas hero (`create-new.png`) anchored to bottom dock
- [ ] “＋ New” command menu with categories
- [ ] Income Source modal (`create-income.png`)
- [ ] Pod modal (`create-pod.png`)
- [ ] Account type picker stepper (`type-of-account.png`, `create-investment.png`, `create-liability.png`)
- [ ] Link external accounts flow (`link-accounts.png`)
- [ ] Automation entry selection (`create-rule.png`)

## 5. Rule Builder Drawer
- [ ] Slide-over drawer layout (`create-funding-rule.png`)
- [ ] Trigger configuration (incoming funds vs date)
- [ ] Condition builder scaffold (add/remove conditions)
- [ ] Allocation list with percent/fixed modes, validation, “% remaining” indicator
- [ ] Add target account inline (launch node modal)
- [ ] Rule save states (saving/saved/error) + audit logging

## 6. Persistence & Collaboration (Convex)
- [ ] Schema implementation for workspaces, nodes, edges, rules, allocations, sessions
- [ ] Queries: `getCanvas`, `listRulesForNode`, `listAllocations`
- [ ] Mutations: node CRUD, edge CRUD, rule create/update, position batching, snapshot save
- [ ] Real-time subscriptions (Convex queries integrated into Solid store)
- [ ] Optimistic updates + rollback on failure
- [ ] Audit events for rule changes

## 7. Polish & Support
- [ ] Accessible focus states, ARIA for dialogs/dock controls
- [ ] Keyboard shortcuts cheat sheet
- [ ] Motion easing (node hover, drawer open, edge connect)
- [ ] Theming tokens documented (`tokens.css`)
- [ ] Smoke tests (Playwright) for create node → link → rule flow
- [ ] Readme update with setup + development instructions

---

## Milestone Planning

1. **M1 – Canvas Interactions**
   - Complete Canvas Core checklist (except undo/redo)
   - Implement node card variants + selection
   - Edge preview + creation gestures

2. **M2 – Creation & Automations**
   - Empty state + New menu + all node creation modals
   - Rule drawer end-to-end (UI + local validation)
   - Inline node metadata/drawer experience

3. **M3 – Persistence & Realtime**
   - Convex schema + core queries/mutations
   - Wire Solid store to Convex subscriptions
   - Implement save/undo with canvas sessions

4. **M4 – Polish & QA**
   - Accessibility, shortcuts, motion polish
   - Automated tests + documentation refresh
   - Production build pipeline readiness

Each milestone should result in a working demo deploy (e.g., Vercel preview) for stakeholder review.
