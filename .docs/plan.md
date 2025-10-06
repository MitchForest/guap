# Canvas Experience Build Plan

This plan follows the Sequence reference screens in `.docs/get-sequence-screenshots` and outlines the steps to reproduce the UX in Solid + Tailwind with a Convex backend.

**Latest progress**
- Core design tokens captured in `apps/frontend/src/styles/tokens.css` (typography, spacing, shadows, node accent colors).
- Convex data model draft documented in `apps/backend/README.md` for upcoming backend implementation.

## Phase 0 · Foundations & Design Tokens
1. **Audit visuals** from `final-state.png`, `create-funding-rule.png`, `create-new.png` to extract colors, spacing (8px grid), shadows, corner radii, typography scale (Inter 12/14/16/20/24). Encode shared tokens in CSS variables/Tailwind config.
2. **Establish icon catalogue** mirroring the emoji set used across `create-income.png`, `create-pod.png`, `create-investment.png`, `create-liability.png`. Define a mapping from node type → emoji/accent color.
3. **Define data primitives**:
   - Node: `{ id, type, label, category, icon, balance, position, meta }`
   - Edge: `{ id, sourceId, targetId, ruleId, annotations }`
   - Rule: `{ id, trigger, conditions[], actions[], allocations[], status }`
   - Workspace/session metadata for save state.
4. **Create Convex schema draft** aligning to the above (tables: `workspaces`, `nodes`, `edges`, `rules`, `ruleAllocations`, `ruleConditions`). Add indexes for workspace + node lookups and subscriptions.

## Phase 1 · Application Shell
5. **Top bar (`TopBar`)**: replicate layout from `create-funding-rule.png` and `create-new.png`—brand chip, title/subtitle stack, right actions (`Save`, `Cancel/Exit`). Introduce save-state indicator (idle/saving/error).
6. **Bottom dock (`BottomDock`)**: copy the bubble toolbar from `create-new.png` with primary “＋ New” plus link/zoom controls. Implement active/disabled states and keyboard shortcuts (e.g., `N` for new node).
7. **Full-screen layout**: ensure app root renders top bar + main canvas area with optional right-side drawers for rules.

## Phase 2 · Canvas Infrastructure
8. **Viewport component**: finish pan/zoom interactions (already prototyped) with inertia + limit boundaries. Add grid background from `final-state.png`/`create-funding-rule.png`. Display current zoom percentage in the dock.
9. **Selection layer**: highlight selected nodes/edges with shadow/glow (observed in `final-state.png`). Support marquee selection (drag area) to match pro-diagramming feel.
10. **Context menus**: right-click on canvas/node opens Solid UI popover with quick actions (duplicate, delete, re-align), matching Sequence tone.
11. **Undo/redo stack** for viewport transforms, node positions, edge connections.

## Phase 3 · Node Rendering & Interactions
12. **Node cards**: style to match `final-state.png`—emoji badge, label, balance, subtle gradient top border. Provide size variants for income vs pod cards when required.
13. **Drag & snap**: adapt the Solid drag gist for pointer-based dragging. Snap to 28px grid to align connectors. Persist new positions immediately via Convex mutation with debounce.
14. **Anchors**: expose top/bottom anchor points (dashed connectors like `create-funding-rule.png`). Visual feedback on hover/drag.
15. **Inline editing**: double-click card to open mini form to rename or update balance (inline editing overlay referencing modal style from `create-pod.png`).
16. **Status badges**: show rule icons or warning states (e.g., allocation mismatch) using badges similar to pill chips in `create-funding-rule.png`.

## Phase 4 · Edge Management
17. **Edge creation gesture**: drag from source anchor to target; show preview line that mirrors Sequence’s smooth bezier (dashed while in-progress, solid on drop). Auto-scroll canvas when nearing edges.
18. **Edge labels/metadata**: allow optional label chip hovering near the target (for rule summary). Provide context popover on click to edit associated rule/allocation.
19. **Edge routing**: implement simple vertical-first curves (current) then add horizontal offset logic to avoid overlaps, matching `final-state.png` form.
20. **Edge deletion/reassignment**: keyboard `Delete` or context menu to remove, with confirmation when rule bindings exist.

## Phase 5 · Empty State & Onboarding
21. **Empty canvas hero** like `create-new.png`: centered illustration, headline, descriptive text. CTA opens the “Create new” floating menu anchored to dock.
22. **Tooltip walkthrough**: short product tour guiding creation of first income source, rule, etc., utilizing Solid UI’s tour component (or custom popovers).

## Phase 6 · Node Creation Flows
23. **Quick create menu**: replicate the bottom dock dropdown from `create-new.png`. Items: `Income Source`, `Pod`, `Account`, `Automation`. Use Solid UI `DropdownMenu` with icons and descriptions.
24. **Income source modal** (`create-income.png`): simple single-field form with validation. Show emoji header. Submit creates node with default icon/accent and centers it near viewport focus.
25. **Pod modal** (`create-pod.png`): same pattern, but allow optional starting balance.
26. **Account type picker** (`create-investment.png`, `create-liability.png`, `type-of-account.png`): step 1 list-of-cards selection, step 2 detail form capturing account metadata (bank link, balance). Make the cards keyboard navigable and responsive.
27. **Automation entry**: follow `create-rule.png` first step to choose “Triggered by incoming funds” vs “Triggered by date”. After selection, open right-side drawer (see Phase 7).

## Phase 7 · Rule Builder Drawer
28. **Drawer layout**: slide-over panel anchored to the right (see `create-funding-rule.png`). Maintain sticky header with rule title, trigger summary, close (`X`), Save/Cancel buttons at footer.
29. **Trigger section**: replicates pill selectors and dropdown for income source (funds received in). Use Solid UI `Select` with emoji icons.
30. **Condition builder**: stub for future custom filters (plus button as in screenshot). For Phase 1, allow only default “Always” condition.
31. **Action list**: support multiple allocations. Each row: action dropdown (Transfer %, Transfer fixed amount), percentage input, target account select with emoji list. Display “% remaining” indicator automatically.
32. **Add account** link**: opens quick Node create modal pre-populated to add new target, then returns focus to rule drawer.
33. **Validation**: ensure allocations sum to 100%; show `0% remaining` text as in `create-funding-rule.png`. Block save if invalid.
34. **Rule summary**: after save, display rule chip on source node (e.g., icon + “2 allocations”) and detail popover matching Sequence style.

## Phase 8 · Data Persistence & Sync
35. **Convex schema implementation**: create tables defined in Phase 0. Generate client, configure `convex/_generated`, and scaffold queries (`listNodesByWorkspace`, `listEdgesByWorkspace`, `listRulesForNode`).
36. **Mutations/actions**: create operations for node CRUD, edge CRUD, rule save/update, rule allocation adjustments, node position update (batched). Ensure ACID across nodes/edges/rules when saving automation.
37. **Subscriptions**: use Convex `useQuery` for real-time node/edge/rule streams per workspace. Handle optimistic UI for drag/edge creation.
38. **Versioning**: add `canvasSessions` table to track unsaved drafts vs published states (for Save button). Implement snapshot history for undo/redo sync.
39. **Permissions**: placeholder logic; when auth arrives, gate mutations. For now ensure workspace scoping.

## Phase 9 · Polishing & QA
40. **Responsive behavior**: confirm modals/drawers behave on 13" laptops (≥1024px width) and degrade gracefully on smaller screens (scrollable content).
41. **Keyboard & accessibility**: ensure focus states, ARIA labels, keyboard shortcuts for new node, zoom, confirm dialogs.
42. **Animations**: apply `solid-motionone` for node hover lift, edge draw-in, drawer slide transitions mimicking Sequence smoothness.
43. **Testing**: set up Vitest or Playwright smoke tests for key flows (create income source, connect to pod, build rule). Add Convex test cases for rule validation logic.
44. **Analytics hooks**: instrument events (node_create, rule_save) for future product insights.
45. **Documentation**: update README with setup/run instructions for backend, create architecture doc summarizing data model and component tree.

## Deliverables Per Screenshot
- `final-state.png` → Canvas layout, node card styling, edges, zoomed background (Phases 2–4).
- `create-new.png` → Empty state hero + dock menu (Phase 5 & 6).
- `create-income.png`, `create-pod.png` → Modal forms for basic nodes (Phase 6).
- `create-investment.png`, `create-liability.png`, `type-of-account.png` → Account type selection flow (Phase 6).
- `create-funding-rule.png`, `funding-rule.png` → Rule drawer UI + allocations (Phase 7).
- `create-rule.png` → Trigger selection step (Phase 6/7 entry point).
- `create-funding-rule.png` (dashed edge preview) → Edge creation flow (Phase 4).
- `pod-drawer.png`, `link-accounts.png` → Additional detail panels for node info and account linking (Phase 6 extension).
- `final-state.png` (top nav) → Save/Exit states (Phase 1 + Phase 8).

Following these phases sequentially will reproduce the Sequence canvas with fidelity while keeping the codebase modular and ready for Convex-backed real-time collaboration.
