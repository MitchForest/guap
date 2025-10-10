import { AsyncQueuer, type AsyncQueuerOptions } from '@tanstack/pacer';

export type ProviderTask<T = unknown> = () => Promise<T>;

export type ProviderQueueSnapshot = {
  waiting: number;
  running: number;
  timestamp: number;
};

type TelemetryEventBase = {
  providerId?: string;
  taskId: string;
  queuedAt: number;
  snapshot: ProviderQueueSnapshot;
};

type TelemetryStartedEvent = TelemetryEventBase & {
  startedAt: number;
};

type TelemetryResultEvent<T = unknown> = TelemetryStartedEvent & {
  durationMs: number;
  result: T;
};

type TelemetryErrorEvent = TelemetryStartedEvent & {
  durationMs: number;
  error: unknown;
};

type TelemetrySettledEvent = TelemetryStartedEvent & {
  durationMs: number;
  status: 'success' | 'error';
};

type TelemetryRejectedEvent = TelemetryEventBase & {
  reason?: unknown;
};

export type ProviderQueueTelemetry<T = unknown> = {
  onTaskQueued?(event: TelemetryEventBase): void;
  onTaskStarted?(event: TelemetryStartedEvent): void;
  onTaskSucceeded?(event: TelemetryResultEvent<T>): void;
  onTaskFailed?(event: TelemetryErrorEvent): void;
  onTaskSettled?(event: TelemetrySettledEvent): void;
  onTaskRejected?(event: TelemetryRejectedEvent): void;
};

export type ProviderQueueOptions<T = unknown> = Pick<
  AsyncQueuerOptions<ProviderTask<T>>,
  | 'key'
  | 'maxSize'
  | 'expirationDuration'
  | 'getPriority'
  | 'onReject'
  | 'onError'
  | 'onSuccess'
  | 'onSettled'
  | 'concurrency'
  | 'wait'
> & {
  providerId?: string;
  telemetry?: ProviderQueueTelemetry<T>;
  taskIdFactory?: () => string;
};

export class ProviderQueue<T = unknown> {
  private readonly queue: AsyncQueuer<ProviderTask<T>>;
  private readonly telemetry?: ProviderQueueTelemetry<T>;
  private readonly providerId?: string;
  private readonly taskIdFactory?: () => string;
  private waiting = 0;
  private running = 0;
  private sequence = 0;

  constructor(options: ProviderQueueOptions<T> = {}) {
    const { telemetry, providerId, taskIdFactory, ...queueOptions } = options;
    this.telemetry = telemetry;
    this.providerId = providerId;
    this.taskIdFactory = taskIdFactory;

    this.queue = new AsyncQueuer(async (task) => task(), {
      started: true,
      throwOnError: false,
      ...queueOptions,
    });
  }

  enqueue(task: ProviderTask<T>): Promise<T> {
    const queuedAt = Date.now();
    const taskId = this.nextTaskId();
    this.waiting += 1;

    return new Promise<T>((resolve, reject) => {
      let status: 'success' | 'error' = 'success';

      const wrapped = async () => {
        const startedAt = Date.now();
        // Move task from waiting to running as soon as the queue starts it.
        this.waiting = Math.max(0, this.waiting - 1);
        this.running += 1;
        this.emit('onTaskStarted', {
          ...this.createEventBase(taskId, queuedAt),
          startedAt,
        });

        try {
          const result = await task();
          status = 'success';
          const durationMs = Date.now() - startedAt;
          this.emit('onTaskSucceeded', {
            ...this.createEventBase(taskId, queuedAt),
            startedAt,
            durationMs,
            result,
          });
          resolve(result);
          return result;
        } catch (error) {
          status = 'error';
          const durationMs = Date.now() - startedAt;
          const normalizedError = error instanceof Error ? error : new Error(String(error));
          this.emit('onTaskFailed', {
            ...this.createEventBase(taskId, queuedAt),
            startedAt,
            durationMs,
            error: normalizedError,
          });
          reject(normalizedError);
          throw normalizedError;
        } finally {
          this.running = Math.max(0, this.running - 1);
          const durationMs = Date.now() - startedAt;
          this.emit('onTaskSettled', {
            ...this.createEventBase(taskId, queuedAt),
            startedAt,
            durationMs,
            status,
          });
        }
      };

      const added = this.queue.addItem(wrapped as ProviderTask<T>);
      if (!added) {
        this.waiting = Math.max(0, this.waiting - 1);
        const rejectionError = new Error('Provider queue rejected the task');
        this.emit('onTaskRejected', {
          ...this.createEventBase(taskId, queuedAt),
          reason: rejectionError,
        });
        reject(rejectionError);
        return;
      }

      this.emit('onTaskQueued', this.createEventBase(taskId, queuedAt));
    });
  }

  pause() {
    this.queue.stop();
  }

  resume() {
    this.queue.start();
  }

  get state() {
    return this.queue.store.state;
  }

  private nextTaskId() {
    if (this.taskIdFactory) {
      return this.taskIdFactory();
    }
    this.sequence += 1;
    const prefix = this.providerId ? `${this.providerId}-task` : 'provider-task';
    return `${prefix}-${this.sequence}`;
  }

  private snapshot(): ProviderQueueSnapshot {
    return {
      waiting: this.waiting,
      running: this.running,
      timestamp: Date.now(),
    };
  }

  private createEventBase(taskId: string, queuedAt: number): TelemetryEventBase {
    return {
      providerId: this.providerId,
      taskId,
      queuedAt,
      snapshot: this.snapshot(),
    };
  }

  private emit<K extends keyof ProviderQueueTelemetry<T>>(
    event: K,
    payload: Parameters<NonNullable<ProviderQueueTelemetry<T>[K]>>[0]
  ) {
    const handler = this.telemetry?.[event];
    if (!handler) {
      return;
    }
    (handler as (arg: typeof payload) => void)(payload);
  }
}
