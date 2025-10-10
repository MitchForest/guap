import { describe, expect, it, vi } from 'vitest';
import { ProviderQueue, type ProviderQueueTelemetry } from '../scheduler';

const collectEvents = () => {
  const events: Array<{ type: string; taskId: string; status?: string }> = [];

  const telemetry: ProviderQueueTelemetry<number> = {
    onTaskQueued: (event) => {
      events.push({ type: 'queued', taskId: event.taskId });
      expect(event.snapshot.waiting).toBeGreaterThanOrEqual(0);
    },
    onTaskStarted: (event) => {
      events.push({ type: 'started', taskId: event.taskId });
      expect(event.snapshot.running).toBeGreaterThan(0);
    },
    onTaskSucceeded: (event) => {
      events.push({ type: 'succeeded', taskId: event.taskId });
      expect(event.result).toBe(42);
      expect(event.durationMs).toBeGreaterThanOrEqual(0);
    },
    onTaskFailed: (event) => {
      events.push({ type: 'failed', taskId: event.taskId });
      expect(event.durationMs).toBeGreaterThanOrEqual(0);
    },
    onTaskSettled: (event) => {
      events.push({ type: `settled:${event.status}`, taskId: event.taskId, status: event.status });
    },
  };

  return { events, telemetry };
};

describe('ProviderQueue telemetry', () => {
  it('emits lifecycle telemetry for succeeded and failed tasks', async () => {
    const { events, telemetry } = collectEvents();

    const queue = new ProviderQueue<number>({
      providerId: 'demo',
      telemetry,
      concurrency: 1,
    });

    const success = queue.enqueue(async () => 42);
    const failure = queue.enqueue(async () => {
      throw new Error('boom');
    });

    await expect(success).resolves.toBe(42);
    await expect(failure).rejects.toThrow('boom');

    const types = events.map((event) => event.type);
    expect(types.filter((type) => type === 'queued')).toHaveLength(2);
    expect(types.filter((type) => type === 'started')).toHaveLength(2);
    expect(types.filter((type) => type === 'succeeded')).toHaveLength(1);
    expect(types.filter((type) => type === 'failed')).toHaveLength(1);
    const settledStatuses = events
      .filter((event) => event.type.startsWith('settled'))
      .map((event) => event.status)
      .sort();
    expect(settledStatuses).toEqual(['error', 'success']);
  });

  it('signals rejected enqueue attempts', async () => {
    const telemetry: ProviderQueueTelemetry<number> = {
      onTaskQueued: vi.fn(),
      onTaskRejected: vi.fn(),
    };

    const queue = new ProviderQueue<number>({
      telemetry,
      maxSize: 0,
      concurrency: 1,
    });

    await expect(queue.enqueue(async () => 1)).rejects.toThrow('Provider queue rejected the task');

    expect(telemetry.onTaskRejected).toHaveBeenCalledTimes(1);
    expect(telemetry.onTaskQueued).not.toHaveBeenCalled();
  });
});
