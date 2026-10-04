import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as supertest from 'supertest';
const request = (supertest as any).default || supertest;
import { AppModule } from '../src/app.module';
import { API_PREFIX } from '../src/config/api.config';
import { PrismaService } from '../src/database/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

describe('BranchModule (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let orgId: string;
  let branchId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();
    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // Register test user / tenant
    const regRes = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/register`)
      .send({
        organizationName: 'Branch Test Organization',
        fullName: 'Super Admin User',
        email: `branch.admin.${Date.now()}@testorg.com`,
        password: 'Password123!',
      })
      .expect(201);

    accessToken = regRes.body.data.accessToken;
    orgId = regRes.body.data.user.organizationId;
  });

  afterAll(async () => {
    if (prisma && orgId) {
      await prisma.sms_branchSettings.deleteMany({
        where: { branch: { organizationId: orgId } },
      });
      await prisma.sms_branchContacts.deleteMany({
        where: { branch: { organizationId: orgId } },
      });
      await prisma.sms_branchAddresses.deleteMany({
        where: { branch: { organizationId: orgId } },
      });
      await prisma.sms_branchScheduleOverrides.deleteMany({
        where: { branch: { organizationId: orgId } },
      });
      await prisma.sms_branches.deleteMany({
        where: { organizationId: orgId },
      });
      await prisma.sms_userRoles.deleteMany({
        where: { user: { organizationId: orgId } },
      });
      await prisma.sms_users.deleteMany({
        where: { organizationId: orgId },
      });
      await prisma.sms_roles.deleteMany({
        where: { organizationId: orgId },
      });
      await prisma.sms_organizations
        .delete({ where: { id: orgId } })
        .catch(() => null);
    }
    await app.close();
  });

  describe('Task 2.1: Branch Creation & Profile', () => {
    it('GET /organizations/:orgId/branches/check-code - should check code uniqueness', async () => {
      const res = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/organizations/${orgId}/branches/check-code?code=BLR-01`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.available).toBe(true);
    });

    it('POST /organizations/:orgId/branches - should create a new branch in Draft status', async () => {
      const res = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/organizations/${orgId}/branches`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Indiranagar Flagship',
          code: 'BLR-01',
          branchType: 'flagship',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Indiranagar Flagship');
      expect(res.body.data.code).toBe('BLR-01');
      expect(res.body.data.status).toBe('draft');
      branchId = res.body.data.id;
    });

    it('POST /organizations/:orgId/branches - should block duplicate code and suggest next available code', async () => {
      const res = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/organizations/${orgId}/branches`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Koramangala Express',
          code: 'BLR-01', // duplicate
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.suggestedCode).toBe('BLR-02');
    });

    it('GET /organizations/:orgId/branches - should list branches for organization', async () => {
      const res = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/organizations/${orgId}/branches`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toHaveLength(1);
    });
  });

  describe('Task 2.2: Branch Address', () => {
    it('PUT /organizations/:orgId/branches/:id/address - should update address and auto-generate maps URL', async () => {
      const res = await request(app.getHttpServer())
        .put(`/${API_PREFIX}/organizations/${orgId}/branches/${branchId}/address`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          addressLine1: '100 100 Feet Rd',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560038',
          countryCode: 'IN',
          latitude: 12.9784,
          longitude: 77.6408,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.city).toBe('Bengaluru');
      expect(res.body.data.mapsUrl).toContain('google.com/maps');
    });
  });

  describe('Task 2.3: Branch Contact Information', () => {
    it('PUT /organizations/:orgId/branches/:id/contact - should set contact phone & whatsapp', async () => {
      const res = await request(app.getHttpServer())
        .put(`/${API_PREFIX}/organizations/${orgId}/branches/${branchId}/contact`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          phoneCountryCode: '+91',
          phoneNumber: '+919876543210',
          whatsappNumber: '+919876543210',
          email: 'indiranagar@salon.com',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.phoneNumber).toBe('+919876543210');
    });

    it('PATCH /organizations/:orgId/branches/:id - should now allow moving branch status to Active', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/${API_PREFIX}/organizations/${orgId}/branches/${branchId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          status: 'active',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('active');
    });
  });

  describe('Task 2.5: Working Hours & Schedule Overrides', () => {
    it('POST /organizations/:orgId/branches/:id/schedule-overrides - should create one-off exception', async () => {
      const res = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/organizations/${orgId}/branches/${branchId}/schedule-overrides`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          overrideDate: '2026-11-01',
          isClosed: true,
          reason: 'Deep Cleaning Day',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.override.isClosed).toBe(true);
    });
  });

  describe('Task 2.6: Branch Configuration Settings', () => {
    it('PUT /organizations/:orgId/branches/:id/settings - should update feature flags & tax overrides', async () => {
      const res = await request(app.getHttpServer())
        .put(`/${API_PREFIX}/organizations/${orgId}/branches/${branchId}/settings`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          onlineBookingEnabled: true,
          taxRateOverridePercentage: 18.0,
          walkinQueueEnabled: true,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.taxRateOverridePercentage).toBe('18.00');
    });
  });
});
