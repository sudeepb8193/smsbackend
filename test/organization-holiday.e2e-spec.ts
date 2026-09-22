import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as supertest from 'supertest';
const request = (supertest as any).default || supertest;
import { AppModule } from '../src/app.module';
import { API_PREFIX } from '../src/config/api.config';
import { PrismaService } from '../src/database/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { sms_holidays_status } from '@prisma/client';

describe('OrganizationHolidayModule (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessTokenOrgA: string;
  let accessTokenOrgB: string;
  let orgAId: string;
  let orgBId: string;
  let holidayAId: string;

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

    // Register Tenant A
    const regResA = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/register`)
      .send({
        organizationName: 'Holiday Test Org A',
        fullName: 'Admin Holiday A',
        email: `holiday.admin.a.${Date.now()}@tenant-a.com`,
        password: 'Password123!',
      })
      .expect(201);

    accessTokenOrgA = regResA.body.data.accessToken;
    orgAId = regResA.body.data.user.organizationId;

    // Register Tenant B
    const regResB = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/register`)
      .send({
        organizationName: 'Holiday Test Org B',
        fullName: 'Admin Holiday B',
        email: `holiday.admin.b.${Date.now()}@tenant-b.com`,
        password: 'Password123!',
      })
      .expect(201);

    accessTokenOrgB = regResB.body.data.accessToken;
    orgBId = regResB.body.data.user.organizationId;
  });

  afterAll(async () => {
    if (prisma) {
      const cleanOrg = async (id: string) => {
        if (!id) return;
        await prisma.sms_holidays.deleteMany({ where: { organizationId: id } });
        await prisma.sms_businessHours.deleteMany({
          where: { organizationId: id },
        });
        await prisma.sms_organizationAddresses.deleteMany({
          where: { organizationId: id },
        });
        await prisma.sms_organizationContacts.deleteMany({
          where: { organizationId: id },
        });
        await prisma.sms_userRoles.deleteMany({
          where: { user: { organizationId: id } },
        });
        await prisma.sms_users.deleteMany({ where: { organizationId: id } });
        await prisma.sms_roles.deleteMany({ where: { organizationId: id } });
        await prisma.sms_organizations
          .delete({ where: { id } })
          .catch(() => null);
      };

      await cleanOrg(orgAId);
      await cleanOrg(orgBId);
    }
    if (app) {
      await app.close();
    }
  });

  describe('POST /sms/organizations/me/holidays', () => {
    it('should reject unauthenticated request', async () => {
      await request(app.getHttpServer())
        .post(`/${API_PREFIX}/organizations/me/holidays`)
        .send({
          name: 'Unauth Holiday',
          holidayDate: '2026-10-02',
        })
        .expect(401);
    });

    it('should create an organization holiday for Org A', async () => {
      const res = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/organizations/me/holidays`)
        .set('Authorization', `Bearer ${accessTokenOrgA}`)
        .send({
          name: 'Annual Founders Day',
          description: 'Company founding anniversary',
          holidayDate: '2026-10-02',
          isRecurring: true,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.name).toBe('Annual Founders Day');
      expect(res.body.data.status).toBe(sms_holidays_status.active);
      holidayAId = res.body.data.id;
    });

    it('should reject duplicate holiday in same scope', async () => {
      await request(app.getHttpServer())
        .post(`/${API_PREFIX}/organizations/me/holidays`)
        .set('Authorization', `Bearer ${accessTokenOrgA}`)
        .send({
          name: 'Annual Founders Day',
          holidayDate: '2026-10-02',
        })
        .expect(400);
    });
  });

  describe('GET /sms/organizations/me/holidays', () => {
    it('should list holidays for Org A', async () => {
      const res = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/organizations/me/holidays`)
        .set('Authorization', `Bearer ${accessTokenOrgA}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should enforce multi-tenant isolation (Org B cannot see Org A holidays)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/organizations/me/holidays`)
        .set('Authorization', `Bearer ${accessTokenOrgB}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('PATCH /sms/organizations/me/holidays/:id', () => {
    it('should prevent Org B from updating Org A holiday', async () => {
      await request(app.getHttpServer())
        .patch(`/${API_PREFIX}/organizations/me/holidays/${holidayAId}`)
        .set('Authorization', `Bearer ${accessTokenOrgB}`)
        .send({
          name: 'Hacked Holiday',
        })
        .expect(404);
    });

    it('should allow Org A to update holiday', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/${API_PREFIX}/organizations/me/holidays/${holidayAId}`)
        .set('Authorization', `Bearer ${accessTokenOrgA}`)
        .send({
          name: 'Updated Founders Day',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Updated Founders Day');
    });
  });

  describe('PATCH /sms/organizations/me/holidays/:id/cancel', () => {
    it('should mark holiday status as cancelled', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/${API_PREFIX}/organizations/me/holidays/${holidayAId}/cancel`)
        .set('Authorization', `Bearer ${accessTokenOrgA}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(sms_holidays_status.cancelled);
    });
  });

  describe('DELETE /sms/organizations/me/holidays/:id', () => {
    it('should soft delete holiday', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/${API_PREFIX}/organizations/me/holidays/${holidayAId}`)
        .set('Authorization', `Bearer ${accessTokenOrgA}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.deletedAt).toBeDefined();

      // Ensure soft-deleted holiday is excluded from list queries
      const getRes = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/organizations/me/holidays`)
        .set('Authorization', `Bearer ${accessTokenOrgA}`)
        .expect(200);

      const found = getRes.body.data.find((h: any) => h.id === holidayAId);
      expect(found).toBeUndefined();
    });
  });
});
