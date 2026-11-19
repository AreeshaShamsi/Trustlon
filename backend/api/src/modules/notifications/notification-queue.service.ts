import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type OrderNotificationChannel = 'sms' | 'email' | 'whatsapp';

/**
 * Queue seam for the SMS/email/WhatsApp providers. The default adapter is a
 * safe no-op until a provider is configured; jobs are idempotent by key so a
 * real BullMQ/SQS adapter can replace this without changing checkout.
 */
@Injectable()
export class NotificationQueueService {
  private readonly logger = new Logger(NotificationQueueService.name);
  private readonly enqueued = new Map<string, { attempts: number; nextAttemptAt: Date; status: 'PENDING' | 'SENT' | 'FAILED' }>();
  constructor(private readonly prisma: PrismaService) {}

  enqueueOrderConfirmed(orderId: string, channel: OrderNotificationChannel) {
    const key = `order.confirmed:${orderId}:${channel}`;
    if (this.enqueued.has(key)) return { queued: false, key };
    this.enqueued.set(key, { attempts: 0, nextAttemptAt: new Date(), status: 'PENDING' });
    void this.prisma.notificationJob.upsert({ where: { orderId_channel_event: { orderId, channel, event: 'order.confirmed' } }, create: { orderId, channel, event: 'order.confirmed' }, update: {} }).catch(() => undefined);
    this.logger.debug(`notification queued: ${channel}`);
    return { queued: true, key, attempts: 0, nextAttemptAt: new Date() };
  }

  /** Provider workers can call this independently for each channel. */
  retry(key: string, failed = true) {
    const job = this.enqueued.get(key);
    if (!job || job.status === 'SENT') return null;
    job.attempts += 1;
    if (!failed) job.status = 'SENT';
    else { job.status = job.attempts >= 5 ? 'FAILED' : 'PENDING'; job.nextAttemptAt = new Date(Date.now() + Math.min(300_000, 1000 * 2 ** job.attempts)); }
    return { ...job, key };
  }
}
