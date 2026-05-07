import { JobQueue, JobData, JobResult } from './queue.js';
import { logger } from '../logger.js';

export interface ScheduledJobConfig {
  name: string;
  pattern: string; // Cron pattern
  data?: JobData;
  enabled?: boolean;
}

export class JobScheduler {
  private queue: JobQueue;
  private scheduledJobs: Map<string, ScheduledJobConfig> = new Map();

  constructor(queue: JobQueue) {
    this.queue = queue;
  }

  async schedule(config: ScheduledJobConfig): Promise<void> {
    if (config.enabled === false) {
      logger.info({ name: config.name }, 'Scheduled job is disabled');
      return;
    }

    this.scheduledJobs.set(config.name, config);

    await this.queue.add(
      config.name,
      config.data ?? {},
      {
        repeat: {
          pattern: config.pattern,
        },
      } as any
    );

    logger.info({ name: config.name, pattern: config.pattern }, 'Job scheduled');
  }

  async unschedule(name: string): Promise<void> {
    this.scheduledJobs.delete(name);
    // Remove repeatable job from queue
    const repeatableJobs = await this.queue.getQueue().getRepeatableJobs();
    const job = repeatableJobs.find((j) => j.name === name);
    if (job) {
      await this.queue.getQueue().removeRepeatableByKey(job.key);
      logger.info({ name }, 'Job unscheduled');
    }
  }

  async getScheduledJobs(): Promise<ScheduledJobConfig[]> {
    return Array.from(this.scheduledJobs.values());
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}
