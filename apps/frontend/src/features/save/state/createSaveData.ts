import { Accessor, createMemo } from 'solid-js';
import type { SavingsGoalWithProgress } from '@guap/api';
import { createGuapQuery } from '~/shared/services/queryHelpers';
import { organizationIdFor } from '~/features/money-map/api/cache';
import { fetchSavingsGoals } from '../api/client';

export type SaveSummary = {
  totalGoals: number;
  totalTargetCents: number;
  averageCompletion: number;
};

export const createSaveData = (householdId: Accessor<string | null | undefined>) => {
  const goalsQuery = createGuapQuery({
    source: householdId,
    initialValue: [] as SavingsGoalWithProgress[],
    fetcher: async (householdIdValue) => {
      const organizationId = organizationIdFor(householdIdValue);
      return await fetchSavingsGoals(organizationId);
    },
  });

  const summary = createMemo<SaveSummary>(() => {
    const goals = goalsQuery.data();
    if (!goals.length) {
      return {
        totalGoals: 0,
        totalTargetCents: 0,
        averageCompletion: 0,
      };
    }

    const totals = goals.reduce(
      (acc, item) => {
        acc.totalTargetCents += item.goal.targetAmount.cents;
        acc.percentageSum += item.progress.percentageComplete;
        return acc;
      },
      { totalTargetCents: 0, percentageSum: 0 }
    );

    return {
      totalGoals: goals.length,
      totalTargetCents: totals.totalTargetCents,
      averageCompletion: totals.percentageSum / goals.length,
    };
  });

  return {
    goals: goalsQuery.data,
    goalsLoading: goalsQuery.isLoading,
    goalsError: goalsQuery.error,
    refetchGoals: goalsQuery.refetch,
    summary,
  };
};
