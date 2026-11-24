import { Injectable, Logger } from '@nestjs/common';

export interface LeaveNotificationPayload {
  organizationId: string;
  recipientUserIds: string[];
  eventType:
    | 'LEAVE_SUBMITTED'
    | 'LEAVE_APPROVED'
    | 'LEAVE_REJECTED'
    | 'LEAVE_CANCELLED'
    | 'ACCRUAL_COMPLETED'
    | 'ACCRUAL_FAILED';
  title: string;
  message: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class LeaveNotificationService {
  private readonly logger = new Logger(LeaveNotificationService.name);

  /**
   * Dispatch internal notifications across channels.
   * Seamlessly plugs into Module 40 BullMQ/WebSocket infrastructure when enabled.
   */
  async dispatch(payload: LeaveNotificationPayload): Promise<void> {
    this.logger.log(
      `[LEAVE NOTIFICATION] Event: ${payload.eventType} | Org: ${payload.organizationId} | Recipients: ${payload.recipientUserIds.join(
        ', ',
      )} | Message: ${payload.message}`,
    );

    // Future hook: When Module 40 is initialized, queue directly to BullMQ
    // e.g. await this.notificationQueue.add('sendNotification', payload);
  }
}
