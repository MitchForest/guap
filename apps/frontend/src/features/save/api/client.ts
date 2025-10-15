import { z } from 'zod';
import type {
  CreateSavingsGoalInput,
  InitiateSavingsTransferInput,
  SavingsGoalWithProgress,
  UpdateSavingsGoalInput,
} from '@guap/api';
import type { SavingsTransferResult } from '@guap/api';
import { TransferStatusSchema } from '@guap/types';
import { guapApi } from '~/shared/services/guapApi';

export const fetchSavingsGoals = async (organizationId: string): Promise<SavingsGoalWithProgress[]> => {
  return await guapApi.savings.listGoals(organizationId);
};

export const fetchSavingsGoal = async (goalId: string) => {
  return await guapApi.savings.getGoal(goalId);
};

export const fetchSavingsGoalTransfers = async (params: {
  organizationId: string;
  goalId: string;
  status?: z.input<typeof TransferStatusSchema>;
}) => {
  return await guapApi.savings.listTransfers({
    organizationId: params.organizationId,
    goalId: params.goalId,
    status: params.status,
  });
};

export const createSavingsGoal = async (input: CreateSavingsGoalInput) => {
  return await guapApi.savings.createGoal(input);
};

export const updateSavingsGoal = async (input: UpdateSavingsGoalInput) => {
  return await guapApi.savings.updateGoal(input);
};

export const archiveSavingsGoal = async (organizationId: string, goalId: string) => {
  return await guapApi.savings.archiveGoal({ organizationId, goalId });
};

export const initiateSavingsTransfer = async (
  input: InitiateSavingsTransferInput
): Promise<SavingsTransferResult> => {
  return await guapApi.savings.initiateTransfer(input);
};
