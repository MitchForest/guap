import type { ConvexClientInstance } from './core/client';
import { createConvexClient } from './core/client';
import type { BackendApi } from './core/types';
import {
  createMoneyMapsApi,
  MoneyMapsApi,
  MoneyMapSaveInputSchema,
  createMoneyMapSaveInput,
  workspaceGraphFromSnapshot,
  type MoneyMapDraft,
  type MoneyMapDraftFlowInput,
  type MoneyMapDraftNodeInput,
  type MoneyMapDraftRuleInput,
  type MoneyMapGraphAllocation,
  type MoneyMapGraphData,
  type MoneyMapGraphEdge,
  type MoneyMapGraphNode,
  type MoneyMapGraphRule,
  type MoneyMapEdgeInput,
  type MoneyMapNodeInput,
  type MoneyMapRuleInput,
  type MoneyMapSaveInput,
  type SubmitChangeRequestInput,
  type UpdateChangeRequestStatusInput,
} from './domains/moneyMaps';
import {
  createAuthApi,
  AuthApi,
  type AuthCompleteSignupInput,
  type AuthCompleteSignupResult,
} from './domains/auth';
import { createAccountsApi, AccountsApi } from './domains/accounts';
import { createTransactionsApi, TransactionsApi } from './domains/transactions';
import { createBudgetsApi, BudgetsApi } from './domains/budgets';
import { createEarnApi, EarnApi, type EarnStatus } from './domains/earn';
import { createSavingsApi, SavingsApi } from './domains/savings';
import {
  createInvestingApi,
  InvestingApi,
} from './domains/investing';
import { createDonateApi, DonateApi, type DonateStatus } from './domains/donate';
import { createEventsApi, EventsApi } from './domains/events';
import { createTransfersApi, TransfersApi } from './domains/transfers';
import { createLiabilitiesApi, LiabilitiesApi } from './domains/liabilities';
import type {
  MoneyMapChangeRequestRecord,
  MoneyMapChangeStatus,
  MoneyMapSnapshot,
  MoneyMapNodeKind,
  MoneyMapRuleTrigger,
} from '@guap/types';

export { createConvexClient };
export type { ConvexClientInstance };
export type { BackendApi } from './core/types';

export {
  createMoneyMapSaveInput,
  workspaceGraphFromSnapshot,
  MoneyMapSaveInputSchema,
  type MoneyMapDraftNodeInput,
  type MoneyMapDraftFlowInput,
  type MoneyMapDraftRuleInput,
  type MoneyMapDraft,
  type MoneyMapGraphNode,
  type MoneyMapGraphEdge,
  type MoneyMapGraphRule,
  type MoneyMapGraphAllocation,
  type MoneyMapGraphData,
  type MoneyMapNodeInput,
  type MoneyMapEdgeInput,
  type MoneyMapRuleInput,
  type MoneyMapSaveInput,
  type SubmitChangeRequestInput,
  type UpdateChangeRequestStatusInput,
} from './domains/moneyMaps';
export {
  type AuthCompleteSignupInput,
  type AuthCompleteSignupResult,
} from './domains/auth';
export type { EarnStatus } from './domains/earn';
export type { DonateStatus } from './domains/donate';
export type {
  HouseholdRecord,
  MembershipRecord,
  ProfileRecord,
  AccountRecord,
  FinancialAccountRecord,
  AccountSnapshotRecord,
  IncomeRecord,
  RequestRecord,
  TransactionRecord,
  CategoryRuleRecord,
  TransferRecord,
  EventJournalRecord,
  EventReceiptRecord,
  BudgetRecord,
  BudgetActuals,
  BudgetWithActuals,
  BudgetSummary,
  BudgetGuardrailSummary,
  CreateBudgetInput,
  UpdateBudgetInput,
  LiabilityTermsRecord,
  MoneyMapSnapshot,
  InvestmentPositionRecord,
  InvestmentOrderRecord,
  WatchlistEntryRecord,
  InstrumentSnapshotRecord,
  InvestmentGuardrailEvaluation,
  InvestmentGuardrailSummary,
  CreateInvestmentOrderInput,
  ApproveInvestmentOrderInput,
  CancelInvestmentOrderInput,
  MoneyMapChangeStatus,
  MoneyMapChangeRequestRecord,
  MoneyMapNodeKind,
  MoneyMapRuleTrigger,
  SavingsGoalRecord,
  SavingsGoalProgress,
  SavingsGuardrailSummary,
  GuardrailApprovalPolicy,
  GuardrailScope,
  SavingsGoalWithProgress,
  CreateSavingsGoalInput,
  UpdateSavingsGoalInput,
  InitiateSavingsTransferInput,
  UpsertLiabilityTermsInput,
} from '@guap/types';
export type { SavingsTransferResult } from './domains/savings/client';

export class GuapApi {
  readonly moneyMaps: MoneyMapsApi;
  readonly auth: AuthApi;
  readonly accounts: AccountsApi;
  readonly transactions: TransactionsApi;
  readonly budgets: BudgetsApi;
  readonly earn: EarnApi;
  readonly savings: SavingsApi;
  readonly investing: InvestingApi;
  readonly donate: DonateApi;
  readonly events: EventsApi;
  readonly transfers: TransfersApi;
  readonly liabilities: LiabilitiesApi;

  constructor(private readonly client: ConvexClientInstance) {
    this.moneyMaps = createMoneyMapsApi(client);
    this.auth = createAuthApi(client);
    this.accounts = createAccountsApi(client);
    this.transactions = createTransactionsApi(client);
    this.budgets = createBudgetsApi(client);
    this.earn = createEarnApi(client);
    this.savings = createSavingsApi(client);
    this.investing = createInvestingApi(client);
    this.donate = createDonateApi(client);
    this.events = createEventsApi(client);
    this.transfers = createTransfersApi(client);
    this.liabilities = createLiabilitiesApi(client);
  }

  async loadMoneyMap(organizationId: string): Promise<MoneyMapSnapshot | null> {
    return this.moneyMaps.load(organizationId);
  }

  async saveMoneyMap(payload: MoneyMapSaveInput): Promise<MoneyMapSnapshot> {
    return this.moneyMaps.save(payload);
  }

  async submitChangeRequest(input: SubmitChangeRequestInput): Promise<string> {
    return this.moneyMaps.submitChangeRequest(input);
  }

  async updateChangeRequestStatus(input: UpdateChangeRequestStatusInput): Promise<void> {
    await this.moneyMaps.updateChangeRequestStatus(input);
  }

  async listChangeRequests(
    organizationId: string,
    status?: MoneyMapChangeStatus
  ): Promise<MoneyMapChangeRequestRecord[]> {
    return this.moneyMaps.listChangeRequests(organizationId, status);
  }

  async completeSignup(
    input: AuthCompleteSignupInput
  ): Promise<AuthCompleteSignupResult> {
    return this.auth.completeSignup(input);
  }
}

export const createGuapApi = (client: ConvexClientInstance) => new GuapApi(client);
