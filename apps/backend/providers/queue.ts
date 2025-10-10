import {
  ProviderQueue,
  type ProviderQueueTelemetry,
  type ProviderTask,
} from '@guap/providers';

const queues = new Map<string, ProviderQueue<any>>();

const getQueue = (providerId: string) => {
  if (!queues.has(providerId)) {
    const telemetry: ProviderQueueTelemetry<any> = {
      onTaskQueued: (event) => {
        console.info('[provider][queued]', {
          providerId,
          taskId: event.taskId,
          waiting: event.snapshot.waiting,
        });
      },
      onTaskSucceeded: (event) => {
        console.info('[provider][succeeded]', {
          providerId,
          taskId: event.taskId,
          durationMs: event.durationMs,
        });
      },
      onTaskFailed: (event) => {
        console.error('[provider][failed]', {
          providerId,
          taskId: event.taskId,
          durationMs: event.durationMs,
          error: event.error,
        });
      },
      onTaskRejected: (event) => {
        console.error('[provider][rejected]', {
          providerId,
          taskId: event.taskId,
          reason: event.reason instanceof Error ? event.reason.message : event.reason,
        });
      },
      onTaskSettled: (event) => {
        console.info('[provider][settled]', {
          providerId,
          taskId: event.taskId,
          status: event.status,
          waiting: event.snapshot.waiting,
          running: event.snapshot.running,
        });
      },
    };

    queues.set(
      providerId,
      new ProviderQueue({
        key: providerId,
        concurrency: 1,
        providerId,
        telemetry,
      })
    );
  }
  return queues.get(providerId)!;
};

export const scheduleProviderTask = <T>(providerId: string, task: ProviderTask<T>) =>
  getQueue(providerId).enqueue(task);
