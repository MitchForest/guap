import { Motion } from 'solid-motionone';
import type { Accessor, Component } from 'solid-js';
import { Show, createMemo } from 'solid-js';
import NodeDrawer from '~/components/nodes/NodeDrawer';
import type { NodeAllocationStatus } from '~/components/canvas/NodeCard';
import type { CanvasFlow, CanvasNode, CanvasInflow, CanvasPodType } from '~/types/graph';
import type { RuleRecord } from './types';

type RuleDraft = {
  id?: string;
  sourceNodeId: string;
  trigger: 'incoming' | 'scheduled';
  triggerNodeId: string | null;
  allocations: Array<{ id: string; percentage: number; targetNodeId: string }>;
};

type CanvasDrawerPanelProps = {
  open: Accessor<boolean>;
  node: Accessor<CanvasNode | null>;
  flows: Accessor<CanvasFlow[]>;
  nodes: Accessor<CanvasNode[]>;
  nodeLookup: Accessor<Map<string, CanvasNode>>;
  allocationStatuses: Accessor<Map<string, NodeAllocationStatus>>;
  rulesBySource: Accessor<Map<string, RuleRecord>>;
  registerContainer: (element: HTMLDivElement) => void;
  onClose: () => void;
  onSaveRule: (rule: RuleDraft) => void;
  onUpdateBalance: (nodeId: string, balance: number | null) => void;
  onUpdateInflow: (nodeId: string, inflow: CanvasInflow | null) => void;
  onUpdatePodType: (nodeId: string, podType: CanvasPodType) => void;
  onUpdateReturnRate: (nodeId: string, returnRate: number | null) => void;
};

export const CanvasDrawerPanel: Component<CanvasDrawerPanelProps> = (props) => {
  const outboundFlows = createMemo(() => {
    const selected = props.node();
    if (!selected) return [];
    return props.flows()
      .filter((flow) => flow.sourceId === selected.id)
      .map((flow) => ({
        id: flow.id,
        partnerNodeId: flow.targetId,
        partnerLabel: props.nodeLookup().get(flow.targetId)?.label ?? 'Unknown',
        hasRule: Boolean(flow.ruleId),
        tag: flow.tag,
      }));
  });

  const inboundFlows = createMemo(() => {
    const selected = props.node();
    if (!selected) return [];
    return props.flows()
      .filter((flow) => flow.targetId === selected.id)
      .map((flow) => ({
        id: flow.id,
        partnerNodeId: flow.sourceId,
        partnerLabel: props.nodeLookup().get(flow.sourceId)?.label ?? 'Unknown',
        hasRule: Boolean(flow.ruleId),
        tag: flow.tag,
      }));
  });

  const initialRule = createMemo(() => {
    const selected = props.node();
    if (!selected) return null;
    return props.rulesBySource().get(selected.id) ?? null;
  });

  const allocationDetails = createMemo(() => {
    const rule = initialRule();
    if (!rule) return [];
    return rule.allocations.map((allocation) => ({
      id: allocation.id,
      percentage: allocation.percentage,
      targetLabel: props.nodeLookup().get(allocation.targetNodeId)?.label ?? 'Unknown',
      targetNodeId: allocation.targetNodeId,
    }));
  });

  const allocationStatus = createMemo<NodeAllocationStatus | null>(() => {
    const selected = props.node();
    if (!selected) return null;
    return props.allocationStatuses().get(selected.id) ?? null;
  });

  return (
    <Motion.div
      class="h-full border-l border-slate-200/70 bg-white shadow-xl"
      initial={{ x: 360, opacity: 0 }}
      animate={{ x: props.open() ? 0 : 360, opacity: props.open() ? 1 : 0.4 }}
      transition={{ duration: 0.2, easing: [0.16, 1, 0.3, 1] }}
      ref={props.registerContainer}
    >
      <Show when={props.node()}>
        {(node) => (
          <NodeDrawer
            open={props.open()}
            node={node()}
            nodes={props.nodes()}
            onClose={props.onClose}
            outbound={outboundFlows()}
            inbound={inboundFlows()}
            allocations={allocationDetails()}
            allocationStatus={allocationStatus()}
            initialRule={initialRule()}
            onSaveRule={props.onSaveRule}
            onUpdateBalance={props.onUpdateBalance}
            onUpdateInflow={props.onUpdateInflow}
            onUpdatePodType={props.onUpdatePodType}
            onUpdateReturnRate={props.onUpdateReturnRate}
          />
        )}
      </Show>
    </Motion.div>
  );
};
