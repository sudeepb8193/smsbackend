import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as supertest from 'supertest';
const request = (supertest as any).default || supertest;
import { AppModule } from '../src/app.module';
import { API_PREFIX } from '../src/config/api.config';
import { PrismaService } from '../src/database/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

describe('OrganizationBusinessHoursModule (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessTokenOrgA: string;
  let accessTokenOrgB: string;
  let orgAId: string;
  let orgBId: string;

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
        organizationName: 'Business Hours Test Org A',
        fullName: 'Admin Hours A',
        email: `hours.admin.a.${Date.now()}@tenant-a.com`,
        password: 'Password123!',
      })
      .expect(201);

    accessTokenOrgA = regResA.body.data.accessToken;
    orgAId = regResA.body.data.user.organizationId;

    // Register Tenant B
    const regResB = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/register`)
      .send({
        organizationName: 'Business Hours Test Org B',
        fullName: 'Admin Hours B',
        email: `hours.admin.b.${Date.now()}@tenant-b.com`,
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

  describe('PUT /sms/organizations/me/business-hours', () => {
    it('should reject unauthenticated request', async () => {
      await request(app.getHttpServer())
        .put(`/${API_PREFIX}/organizations/me/business-hours`)
        .send({
          days: [
            {
              dayOfWeek: 1,
              isOpen: true,
              openTime: '09:00',
              closeTime: '17:00',
            },
          ],
        })
        .expect(401);
    });

    it('should update business hours for Org A', async () => {
      const payload = {
        days: [
          {
            dayOfWeek: 1,
            isOpen: true,
            openTime: '09:00',
            closeTime: '18:00',
            breakStartTime: '13:00',
            breakEndTime: '14:00',
          },
          {
            dayOfWeek: 2,
            isOpen: true,
            openTime: '09:00',
            closeTime: '18:00',
          },
          {
            dayOfWeek: 0,
            isOpen: false,
          },
        ],
      };

      const res = await request(app.getHttpServer())
        .put(`/${API_PREFIX}/organizations/me/business-hours`)
        .set('Authorization', `Bearer ${accessTokenOrgA}`)
        .send(payload)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.days).toHaveLength(7);
      const monday = res.body.data.days.find((d: any) => d.dayOfWeek === 1);
      expect(monday.isOpen).toBe(true);
      expect(monday.openTime).toBe('09:00');
    });

    it('should fail when breakStartTime is outside openTime/closeTime', async () => {
      const payload = {
        days: [
          {
            dayOfWeek: 3,
            isOpen: true,
            openTime: '09:00',
            closeTime: '18:00',
            breakStartTime: '08:00',
            breakEndTime: '09:30',
          },
        ],
      };

      await request(app.getHttpServer())
        .put(`/${API_PREFIX}/organizations/me/business-hours`)
        .set('Authorization', `Bearer ${accessTokenOrgA}`)
        .send(payload)
        .expect(400);
    });

    it('should support overnight shifts', async () => {
      const payload = {
        days: [
          {
            dayOfWeek: 5,
            isOpen: true,
            openTime: '20:00',
            closeTime: '04:00',
            breakStartTime: '23:00',
            breakEndTime: '00:00',
          },
        ],
      };

      const res = await request(app.getHttpServer())
        .put(`/${API_PREFIX}/organizations/me/business-hours`)
        .set('Authorization', `Bearer ${accessTokenOrgA}`)
        .send(payload)
        .expect(200);

      const friday = res.body.data.days.find((d: any) => d.dayOfWeek === 5);
      expect(friday).toBeDefined();
      expect(friday.spansMidnight).toBe(true);
    });
  });

  describe('GET /sms/organizations/me/business-hours', () => {
    it('should return configured business hours for Org A', async () => {
      const res = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/organizations/me/business-hours`)
        .set('Authorization', `Bearer ${accessTokenOrgA}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.days).toHaveLength(7);
      const friday = res.body.data.days.find((d: any) => d.dayOfWeek === 5);
      expect(friday.spansMidnight).toBe(true);
    });

    it('should enforce multi-tenant isolation (Org B should have unconfigured/no DB records for days)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/organizations/me/business-hours`)
        .set('Authorization', `Bearer ${accessTokenOrgB}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      // Org B has default fallback schedule, but no records saved in DB (id is null/undefined)
      const hasAnyDbRecord = res.body.data.days.some(
        (d: any) => d.id !== undefined && d.id !== null,
      );
      expect(hasAnyDbRecord).toBe(false);
    });
  });
});
