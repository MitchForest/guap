import '@testing-library/jest-dom';
import { vi } from 'vitest';

if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = vi.fn(() => 'blob:mock');
}

if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = vi.fn();
}

vi.mock('~/shared/services/guapApi', () => ({
  guapApi: {
    events: {
      list: vi.fn(),
      markRead: vi.fn(),
    },
    transfers: {
      list: vi.fn(),
      updateStatus: vi.fn(),
      initiateCreditPayoff: vi.fn(),
    },
    investing: {
      listOrders: vi.fn(),
      approveOrder: vi.fn(),
      cancelOrder: vi.fn(),
    },
    budgets: {
      list: vi.fn(),
      summarize: vi.fn(),
      updateGuardrail: vi.fn(),
    },
    donate: {
      updateGuardrail: vi.fn(),
    },
    guardrails: {
      list: vi.fn(),
    },
    accounts: {
      sync: vi.fn(),
      list: vi.fn(),
    },
    earn: {
      listStreams: vi.fn(),
    },
  },
}));
