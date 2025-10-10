import {
  AccountKindSchema,
  AccountStatusSchema,
  AutomationEdgeKindSchema,
  AutomationNodeKindSchema,
  MembershipRoleSchema,
  MembershipStatusSchema,
  IncomeCadenceSchema,
  RequestKindSchema,
  RequestStateSchema,
  UserRoleSchema,
  WealthLevelSchema,
  WorkspaceEdgeRecordSchema,
  WorkspaceGraphRecordSchema,
  WorkspaceNodeKindSchema,
  WorkspaceNodeRecordSchema,
  WorkspaceNodePositionSchema,
  WorkspacePublishPayloadSchema,
  WorkspacePublishResultSchema,
  WorkspaceRecordSchema,
  WorkspaceRuleAllocationRecordSchema,
  WorkspaceRuleRecordSchema,
  WorkspaceRuleTriggerSchema,
} from './schemas';

export * from './schemas';

export type UserRole = typeof UserRoleSchema._type;
export type MembershipRole = typeof MembershipRoleSchema._type;
export type MembershipStatus = typeof MembershipStatusSchema._type;
export type AccountKind = typeof AccountKindSchema._type;
export type AccountStatus = typeof AccountStatusSchema._type;
export type IncomeCadence = typeof IncomeCadenceSchema._type;
export type AutomationNodeKind = typeof AutomationNodeKindSchema._type;
export type AutomationEdgeKind = typeof AutomationEdgeKindSchema._type;
export type WealthLevel = typeof WealthLevelSchema._type;
export type RequestKind = typeof RequestKindSchema._type;
export type RequestState = typeof RequestStateSchema._type;
export type WorkspaceRecord = typeof WorkspaceRecordSchema._type;
export type WorkspaceNodeKind = typeof WorkspaceNodeKindSchema._type;
export type WorkspaceNodePosition = typeof WorkspaceNodePositionSchema._type;
export type WorkspaceNodeRecord = typeof WorkspaceNodeRecordSchema._type;
export type WorkspaceEdgeRecord = typeof WorkspaceEdgeRecordSchema._type;
export type WorkspaceRuleTrigger = typeof WorkspaceRuleTriggerSchema._type;
export type WorkspaceRuleRecord = typeof WorkspaceRuleRecordSchema._type;
export type WorkspaceRuleAllocationRecord = typeof WorkspaceRuleAllocationRecordSchema._type;
export type WorkspaceGraphRecord = typeof WorkspaceGraphRecordSchema._type;
export type WorkspacePublishPayload = typeof WorkspacePublishPayloadSchema._type;
export type WorkspacePublishResult = typeof WorkspacePublishResultSchema._type;
