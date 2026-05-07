import { Queue, Worker, Job, QueueOptions, WorkerOptions } from 'bullmq';
import { createClient } from 'redis';
import { logger } from '../logger.js';

export interface JobData {
  [key: string]: any;
}

export interface JobResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface QueueConfig {
  name: string;
  redisUrl?: string;
  defaultJobOptions?: {
    attempts?: number;
    backoff?: {
      type: 'exponential' | 'fixed';
      delay: number;
    };
    removeOnComplete?: boolean | number;
    removeOnFail?: boolean | number;
  };
}

export class JobQueue<T extends JobData = JobData, R extends JobResult = JobResult> {
  private queue: Queue<T, R>;
  private worker?: Worker<T, R>;
  private readonly config: QueueConfig;

  constructor(config: QueueConfig) {
    this.config = config;

    const connection = {
      host: this.parseRedisUrl(config.redisUrl).host,
      port: this.parseRedisUrl(config.redisUrl).port,
    };

    this.queue = new Queue<T, R>(config.name, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 500, // Keep last 500 failed jobs
        ...config.defaultJobOptions,
      },
    });

    logger.info({ queueName: config.name }, 'Job queue initialized');
  }

  private parseRedisUrl(url?: string): { host: string; port: number } {
    const redisUrl = url ?? process.env.REDIS_URL ?? 'redis://localhost:6379';
    const parsed = new URL(redisUrl);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port) || 6379,
    };
  }

  async add(
    name: string,
    data: T,
    options?: {
      priority?: number;
      delay?: number;
      attempts?: number;
      jobId?: string;
    }
  ): Promise<Job<T, R>> {
    try {
      const job = await this.queue.add(name, data, options);
      logger.debug({ jobId: job.id, name, queueName: this.config.name }, 'Job added to queue');
      return job;
    } catch (error) {
      logger.error({ error, name, queueName: this.config.name }, 'Failed to add job to queue');
      throw error;
    }
  }

  async addBulk(
    jobs: Array<{
      name: string;
      data: T;
      opts?: {
        priority?: number;
        delay?: number;
        attempts?: number;
      };
    }>
  ): Promise<Job<T, R>[]> {
    try {
      const addedJobs = await this.queue.addBulk(jobs);
      logger.info({ count: jobs.length, queueName: this.config.name }, 'Bulk jobs added to queue');
      return addedJobs;
    } catch (error) {
      logger.error({ error, queueName: this.config.name }, 'Failed to add bulk jobs');
      throw error;
    }
  }

  createWorker(
    processor: (job: Job<T, R>) => Promise<R>,
    options?: WorkerOptions
  ): Worker<T, R> {
    const connection = {
      host: this.parseRedisUrl(this.config.redisUrl).host,
      port: this.parseRedisUrl(this.config.redisUrl).port,
    };

    this.worker = new Worker<T, R>(
      this.config.name,
      async (job) => {
        logger.debug({ jobId: job.id, name: job.name }, 'Processing job');
        try {
          const result = await processor(job);
          logger.info({ jobId: job.id, name: job.name }, 'Job completed successfully');
          return result;
        } catch (error) {
          logger.error({ jobId: job.id, name: job.name, error }, 'Job processing failed');
          throw error;
        }
      },
      {
        connection,
        concurrency: 5,
        ...options,
      }
    );

    this.worker.on('completed', (job) => {
      logger.info({ jobId: job.id, name: job.name }, 'Job completed');
    });

    this.worker.on('failed', (job, err) => {
      logger.error({ jobId: job?.id, name: job?.name, error: err }, 'Job failed');
    });

    this.worker.on('error', (err) => {
      logger.error({ error: err, queueName: this.config.name }, 'Worker error');
    });

    logger.info({ queueName: this.config.name }, 'Worker started');

    return this.worker;
  }

  async getJob(jobId: string): Promise<Job<T, R> | undefined> {
    return this.queue.getJob(jobId);
  }

  async getJobs(
    types: Array<'completed' | 'failed' | 'delayed' | 'active' | 'waiting' | 'paused'>,
    start = 0,
    end = 10
  ): Promise<Job<T, R>[]> {
    return this.queue.getJobs(types, start, end);
  }

  async getJobCounts(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  }> {
    return this.queue.getJobCounts();
  }

  async pause(): Promise<void> {
    await this.queue.pause();
    logger.info({ queueName: this.config.name }, 'Queue paused');
  }

  async resume(): Promise<void> {
    await this.queue.resume();
    logger.info({ queueName: this.config.name }, 'Queue resumed');
  }

  async clean(grace: number, limit: number, type: 'completed' | 'failed'): Promise<string[]> {
    const jobs = await this.queue.clean(grace, limit, type);
    logger.info({ count: jobs.length, type, queueName: this.config.name }, 'Queue cleaned');
    return jobs;
  }

  async obliterate(options?: { force?: boolean }): Promise<void> {
    await this.queue.obliterate(options);
    logger.warn({ queueName: this.config.name }, 'Queue obliterated');
  }

  async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
    await this.queue.close();
    logger.info({ queueName: this.config.name }, 'Queue closed');
  }

  getQueue(): Queue<T, R> {
    return this.queue;
  }

  getWorker(): Worker<T, R> | undefined {
    return this.worker;
  }
}

// Dead Letter Queue for failed jobs
export class DeadLetterQueue<T extends JobData = JobData> {
  private queue: JobQueue<T>;

  constructor(config: QueueConfig) {
    this.queue = new JobQueue({
      ...config,
      name: `${config.name}-dlq`,
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: false,
        removeOnFail: false,
      },
    });
  }

  async add(originalJob: Job<T>, error: Error): Promise<Job<T>> {
    return this.queue.add('failed-job', {
      ...originalJob.data,
      _dlq: {
        originalJobId: originalJob.id,
        originalQueue: originalJob.queueName,
        failedAt: new Date().toISOString(),
        error: error.message,
        stack: error.stack,
        attemptsMade: originalJob.attemptsMade,
      },
    } as T);
  }

  async getFailedJobs(start = 0, end = 50): Promise<Job<T>[]> {
    return this.queue.getJobs(['waiting', 'completed', 'failed'], start, end);
  }

  async retry(jobId: string, targetQueue: JobQueue<T>): Promise<void> {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found in DLQ`);
    }

    const { _dlq, ...originalData } = job.data as any;
    await targetQueue.add('retry', originalData as T);
    await job.remove();

    logger.info({ jobId, originalQueue: _dlq.originalQueue }, 'Job retried from DLQ');
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}

// Priority queue helper
export enum JobPriority {
  CRITICAL = 1,
  HIGH = 2,
  NORMAL = 3,
  LOW = 4,
  BACKGROUND = 5,
}

export function createPriorityQueue<T extends JobData = JobData>(
  config: QueueConfig
): JobQueue<T> {
  return new JobQueue<T>({
    ...config,
    defaultJobOptions: {
      ...config.defaultJobOptions,
      priority: JobPriority.NORMAL,
    },
  });
}
