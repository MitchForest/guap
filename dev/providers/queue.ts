import { ProviderQueue, type ProviderQueueTelemetry, type ProviderTask } from '@guap/providers';

const queues = new Map<string, ProviderQueue<any>>();

const createTelemetry = (providerId: string): ProviderQueueTelemetry => ({
  onTaskQueued: (event) => {
    console.info('[provider][queue][queued]', { providerId, taskId: event.taskId, snapshot: event.snapshot });
  },
  onTaskStarted: (event) => {
    console.info('[provider][queue][started]', { providerId, taskId: event.taskId, snapshot: event.snapshot });
  },
  onTaskSucceeded: (event) => {
    console.info('[provider][queue][succeeded]', {
      providerId,
      taskId: event.taskId,
      durationMs: event.durationMs,
    });
  },
  onTaskFailed: (event) => {
    console.warn('[provider][queue][failed]', {
      providerId,
      taskId: event.taskId,
      durationMs: event.durationMs,
      error: event.error instanceof Error ? event.error.message : event.error,
    });
  },
  onTaskSettled: (event) => {
    console.info('[provider][queue][settled]', {
      providerId,
      taskId: event.taskId,
      status: event.status,
      durationMs: event.durationMs,
    });
  },
  onTaskRejected: (event) => {
    console.warn('[provider][queue][rejected]', {
      providerId,
      taskId: event.taskId,
      snapshot: event.snapshot,
      reason: event.reason instanceof Error ? event.reason.message : event.reason,
    });
  },
});

const getQueue = (providerId: string) => {
  let queue = queues.get(providerId);
  if (!queue) {
    queue = new ProviderQueue({
      providerId,
      concurrency: 1,
      telemetry: createTelemetry(providerId),
    });
    queues.set(providerId, queue);
  }
  return queue as ProviderQueue<unknown>;
};

export const scheduleProviderTask = async <T>(providerId: string, task: ProviderTask<T>) => {
  const queue = getQueue(providerId) as ProviderQueue<T>;
  return await queue.enqueue(task);
};
