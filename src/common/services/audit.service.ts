import { Injectable, Logger } from '@nestjs/common';

export interface AuditLogPayload {
  organizationId: number;
  actorId?: number | string;
  action: string;
  targetId?: number | string;
  details?: Record<string, any>;
  ipAddress?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger('AuditService');

  logEvent(payload: AuditLogPayload) {
    // Sanitize any potential sensitive keys before logging
    const sanitizedDetails = payload.details ? { ...payload.details } : {};
    delete sanitizedDetails.password;
    delete sanitizedDetails.newPassword;
    delete sanitizedDetails.currentPassword;
    delete sanitizedDetails.inviteToken;
    delete sanitizedDetails.twoFactorSecret;

    const logMessage = {
      timestamp: new Date().toISOString(),
      organizationId: payload.organizationId,
      actorId: payload.actorId || 'SYSTEM',
      action: payload.action,
      targetId: payload.targetId,
      details: sanitizedDetails,
      ipAddress: payload.ipAddress || 'internal',
    };

    this.logger.log(`[AUDIT] ${payload.action} - ${JSON.stringify(logMessage)}`);
  }
}
