import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as supertest from 'supertest';
const request = (supertest as any).default || supertest;
import { AppModule } from '../src/app.module';
import { API_PREFIX } from '../src/config/api.config';
import { PrismaService } from '../src/database/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

describe('OrganizationModule (e2e)', () => {
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
        organizationName: 'Tenant A Salon',
        fullName: 'Admin A',
        email: `admin.a.${Date.now()}@tenant-a.com`,
        password: 'Password123!',
      })
      .expect(201);

    accessTokenOrgA = regResA.body.data.accessToken;
    orgAId = regResA.body.data.user.organizationId;

    // Register Tenant B
    const regResB = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/register`)
      .send({
        organizationName: 'Tenant B Spa',
        fullName: 'Admin B',
        email: `admin.b.${Date.now()}@tenant-b.com`,
        password: 'Password123!',
      })
      .expect(201);

    accessTokenOrgB = regResB.body.data.accessToken;
    orgBId = regResB.body.data.user.organizationId;
  });

  afterAll(async () => {
    if (prisma) {
      if (orgAId) {
        await prisma.sms_organizationAddresses.deleteMany({
          where: { organizationId: orgAId },
        });
        await prisma.sms_organizationContacts.deleteMany({
          where: { organizationId: orgAId },
        });
        await prisma.sms_userRoles.deleteMany({
          where: { user: { organizationId: orgAId } },
        });
        await prisma.sms_users.deleteMany({
          where: { organizationId: orgAId },
        });
        await prisma.sms_roles.deleteMany({
          where: { organizationId: orgAId },
        });
        await prisma.sms_organizations
          .delete({ where: { id: orgAId } })
          .catch(() => null);
      }
      if (orgBId) {
        await prisma.sms_organizationAddresses.deleteMany({
          where: { organizationId: orgBId },
        });
        await prisma.sms_organizationContacts.deleteMany({
          where: { organizationId: orgBId },
        });
        await prisma.sms_userRoles.deleteMany({
          where: { user: { organizationId: orgBId } },
        });
        await prisma.sms_users.deleteMany({
          where: { organizationId: orgBId },
        });
        await prisma.sms_roles.deleteMany({
          where: { organizationId: orgBId },
        });
        await prisma.sms_organizations
          .delete({ where: { id: orgBId } })
          .catch(() => null);
      }
    }
    await app.close();
  });

  describe('GET /organizations/me', () => {
    it('should return authenticated user organization profile', async () => {
      const res = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/organizations/me`)
        .set('Authorization', `Bearer ${accessTokenOrgA}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(orgAId);
      expect(res.body.data.name).toBe('Tenant A Salon');
    });

    it('should return 401 Unauthorized without bearer token', async () => {
      await request(app.getHttpServer())
        .get(`/${API_PREFIX}/organizations/me`)
        .expect(401);
    });
  });

  describe('PATCH /organizations/me', () => {
    it('should update organization branding and identity for Tenant A', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/${API_PREFIX}/organizations/me`)
        .set('Authorization', `Bearer ${accessTokenOrgA}`)
        .send({
          name: 'Tenant A Premium Salon',
          legalName: 'Tenant A Services Pvt Ltd',
          businessType: 'salon',
          brandPrimaryColor: '#8A4A52',
          brandSecondaryColor: '#F5E6E8',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Tenant A Premium Salon');
      expect(res.body.data.legalName).toBe('Tenant A Services Pvt Ltd');
      expect(res.body.data.brandPrimaryColor).toBe('#8A4A52');
    });

    it('should reject invalid hex color format with 400 Bad Request', async () => {
      await request(app.getHttpServer())
        .patch(`/${API_PREFIX}/organizations/me`)
        .set('Authorization', `Bearer ${accessTokenOrgA}`)
        .send({
          brandPrimaryColor: 'invalid-red',
        })
        .expect(400);
    });
  });

  describe('GET /organizations/slug-availability', () => {
    it('should return available: true for unused slug', async () => {
      const res = await request(app.getHttpServer())
        .get(
          `/${API_PREFIX}/organizations/slug-availability?slug=completely-new-unique-slug-${Date.now()}`,
        )
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.available).toBe(true);
    });
  });

  describe('POST /organizations/me/activate', () => {
    it('should activate Tenant A organization after requirements are satisfied', async () => {
      // Seed required primary contact
      await request(app.getHttpServer())
        .post(`/${API_PREFIX}/organizations/me/contacts`)
        .set('Authorization', `Bearer ${accessTokenOrgA}`)
        .send({
          contactType: 'primary',
          contactName: 'Main Helpdesk',
          email: 'primary@tenant-a.com',
          phoneCountryCode: '+91',
          phoneNumber: '9876543210',
        })
        .expect(201);

      // Seed required registered address
      await request(app.getHttpServer())
        .post(`/${API_PREFIX}/organizations/me/addresses`)
        .set('Authorization', `Bearer ${accessTokenOrgA}`)
        .send({
          addressType: 'registered',
          addressLine1: '789 Business Ave',
          city: 'New York',
          state: 'NY',
          postalCode: '10005',
          country: 'USA',
        })
        .expect(201);

      // Seed required business hours
      await request(app.getHttpServer())
        .put(`/${API_PREFIX}/organizations/me/business-hours`)
        .set('Authorization', `Bearer ${accessTokenOrgA}`)
        .send({
          days: [
            {
              dayOfWeek: 1,
              isOpen: true,
              openTime: '09:00',
              closeTime: '18:00',
            },
          ],
        })
        .expect(200);

      const res = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/organizations/me/activate`)
        .set('Authorization', `Bearer ${accessTokenOrgA}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('active');
    });
  });

  describe('Tenant Security & Isolation (IDOR)', () => {
    it('Tenant B should get its own organization data and never see Tenant A data', async () => {
      const res = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/organizations/me`)
        .set('Authorization', `Bearer ${accessTokenOrgB}`)
        .expect(200);

      expect(res.body.data.id).toBe(orgBId);
      expect(res.body.data.id).not.toBe(orgAId);
    });
  });
});
