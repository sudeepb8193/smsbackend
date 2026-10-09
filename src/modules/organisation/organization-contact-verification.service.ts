import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import * as nodemailer from 'nodemailer';
import { createHash, randomBytes } from 'node:crypto';

const TOKEN_LIFETIME_MS = 30 * 60 * 1000;

@Injectable()
export class OrganizationContactVerificationService {
  private readonly logger = new Logger(
    OrganizationContactVerificationService.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async sendVerificationEmail(
    email: string,
    name: string,
    token: string,
  ) {
    const host = this.configService.get<string>('SMTP_HOST')?.trim();
    const user = this.configService.get<string>('SMTP_USER')?.trim();
    const password = this.configService.get<string>('SMTP_PASS');
    const from = this.configService.get<string>('SMTP_FROM')?.trim() || user;
    const frontendUrl = this.configService.get<string>('FRONTEND_URL')?.trim();
    const port = Number(this.configService.get<string>('SMTP_PORT') || 587);
    const secure = this.configService.get<string>('SMTP_SECURE') === 'true';

    if (
      !host ||
      !user ||
      !password ||
      !from ||
      !frontendUrl ||
      !Number.isInteger(port) ||
      port < 1 ||
      port > 65535
    ) {
      throw new ServiceUnavailableException({
        code: 'SMTP_NOT_CONFIGURED',
        message:
          'Contact verification email is unavailable until SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM, and FRONTEND_URL are configured.',
      });
    }

    const verificationUrl = new URL(
      'verify-contact-email',
      frontendUrl.endsWith('/') ? frontendUrl : `${frontendUrl}/`,
    );
    verificationUrl.searchParams.set('token', token);
    const escapedName = name.replace(
      /[&<>"']/g,
      (character) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[character] || character,
    );

    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass: password },
      });
      await transporter.sendMail({
        from,
        to: email,
        subject: 'Verify your organization contact email',
        text: `Hello ${name}, verify this contact email within 30 minutes: ${verificationUrl.toString()}`,
        html: `<p>Hello ${escapedName},</p><p>Confirm this organization contact email by following the link below. The link expires in 30 minutes.</p><p><a href="${verificationUrl.toString()}">Verify contact email</a></p>`,
      });
    } catch (error) {
      this.logger.error(
        `SMTP delivery failed (${error instanceof Error ? error.name : 'unknown error'}).`,
      );
      throw new BadGatewayException({
        code: 'EMAIL_DELIVERY_FAILED',
        message:
          'The verification email could not be sent. Check SMTP settings and try again.',
      });
    }
  }

  async sendVerification(organizationId: string, contactId: string) {
    const contact = await this.prisma.sms_organizationContacts.findFirst({
      where: { id: contactId, organizationId, deletedAt: null },
      select: { id: true, email: true, contactName: true, emailVerified: true },
    });
    if (!contact?.email) {
      throw new BadRequestException({
        code: 'CONTACT_EMAIL_REQUIRED',
        message:
          'Save a contact with an email address before requesting verification.',
      });
    }
    if (contact.emailVerified) {
      return { message: 'This contact email is already verified.' };
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + TOKEN_LIFETIME_MS);
    await this.prisma.sms_organizationContacts.update({
      where: { id: contact.id },
      data: {
        emailVerificationTokenHash: tokenHash,
        emailVerificationExpiresAt: expiresAt,
      },
    });

    try {
      await this.sendVerificationEmail(
        contact.email,
        contact.contactName || 'there',
        token,
      );
    } catch (error) {
      await this.prisma.sms_organizationContacts.updateMany({
        where: { id: contact.id, emailVerificationTokenHash: tokenHash },
        data: {
          emailVerificationTokenHash: null,
          emailVerificationExpiresAt: null,
        },
      });
      throw error;
    }

    return {
      message: `A verification link was sent to ${contact.email}.`,
      expiresAt,
    };
  }

  async verify(token: string) {
    if (!/^[a-f0-9]{64}$/i.test(token || '')) {
      throw new BadRequestException({
        code: 'EMAIL_VERIFICATION_LINK_INVALID',
        message: 'This email verification link is invalid or has expired.',
      });
    }
    const tokenHash = this.hashToken(token);
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const contact = await tx.sms_organizationContacts.findFirst({
        where: {
          emailVerificationTokenHash: tokenHash,
          emailVerificationExpiresAt: { gt: now },
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!contact) {
        throw new BadRequestException({
          code: 'EMAIL_VERIFICATION_LINK_INVALID',
          message: 'This email verification link is invalid or has expired.',
        });
      }
      const result = await tx.sms_organizationContacts.updateMany({
        where: {
          id: contact.id,
          emailVerificationTokenHash: tokenHash,
          emailVerificationExpiresAt: { gt: now },
        },
        data: {
          emailVerified: true,
          emailVerificationTokenHash: null,
          emailVerificationExpiresAt: null,
        },
      });
      if (result.count !== 1) {
        throw new InternalServerErrorException({
          code: 'EMAIL_VERIFICATION_FAILED',
          message:
            'The contact email could not be verified. Request a new link and try again.',
        });
      }
      return { message: 'Contact email verified successfully.' };
    });
  }
}
