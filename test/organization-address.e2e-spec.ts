import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as supertest from 'supertest';
const request = (supertest as any).default || supertest;
import { AppModule } from '../src/app.module';
import { API_PREFIX } from '../src/config/api.config';
import { PrismaService } from '../src/database/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

describe('OrganizationAddressModule (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessTokenOrgA: string;
  let accessTokenOrgB: string;
  let orgAId: string;
  let orgBId: string;
  let registeredAddressAId: string;
  let billingAddressAId: string;

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
        organizationName: 'Address Test Org A',
        fullName: 'Admin Address A',
        email: `address.admin.a.${Date.now()}@tenant-a.com`,
        password: 'Password123!',
      })
      .expect(201);

    accessTokenOrgA = regResA.body.data.accessToken;
    orgAId = regResA.body.data.user.organizationId;

    // Register Tenant B
    const regResB = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/register`)
      .send({
        organizationName: 'Address Test Org B',
        fullName: 'Admin Address B',
        email: `address.admin.b.${Date.now()}@tenant-b.com`,
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

  describe('POST /organizations/me/addresses', () => {
    it('should create a registered address for Tenant A', async () => {
      const res = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/organizations/me/addresses`)
        .set('Authorization', `Bearer ${accessTokenOrgA}`)
        .send({
          addressType: 'registered',
          addressLine1: '789 Business Ave',
          addressLine2: 'Suite 100',
          landmark: 'Financial District Landmark',
          city: 'New York',
          state: 'NY',
          postalCode: '10005',
          country: 'USA',
          latitude: 40.7075,
          longitude: -74.009,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.addressType).toBe('registered');
      expect(res.body.data.addressLine1).toBe('789 Business Ave');
      expect(res.body.data.city).toBe('New York');
      expect(res.body.data.resolvedAddressLine1).toBe('789 Business Ave');
      registeredAddressAId = res.body.data.id;
    });

    it('should create a billing address with sameAsRegistered = true for Tenant A', async () => {
      const res = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/organizations/me/addresses`)
        .set('Authorization', `Bearer ${accessTokenOrgA}`)
        .send({
          addressType: 'billing',
          sameAsRegistered: true,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.addressType).toBe('billing');
      expect(res.body.data.sameAsRegistered).toBe(true);
      expect(res.body.data.resolvedAddressLine1).toBe('789 Business Ave');
      expect(res.body.data.resolvedCity).toBe('New York');
      billingAddressAId = res.body.data.id;
    });

    it('should reject registered address with sameAsRegistered = true', async () => {
      await request(app.getHttpServer())
        .post(`/${API_PREFIX}/organizations/me/addresses`)
        .set('Authorization', `Bearer ${accessTokenOrgA}`)
        .send({
          addressType: 'registered',
          sameAsRegistered: true,
        })
        .expect(400);
    });

    it('should reject latitude provided without longitude', async () => {
      await request(app.getHttpServer())
        .post(`/${API_PREFIX}/organizations/me/addresses`)
        .set('Authorization', `Bearer ${accessTokenOrgA}`)
        .send({
          addressType: 'registered',
          addressLine1: '123 Test St',
          city: 'Miami',
          state: 'FL',
          postalCode: '33101',
          country: 'USA',
          latitude: 25.7617,
        })
        .expect(400);
    });
  });

  describe('GET /organizations/me/addresses', () => {
    it('should return addresses for Tenant A', async () => {
      const res = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/organizations/me/addresses`)
        .set('Authorization', `Bearer ${accessTokenOrgA}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('GET /organizations/me/addresses/:id', () => {
    it('should return single address details', async () => {
      const res = await request(app.getHttpServer())
        .get(
          `/${API_PREFIX}/organizations/me/addresses/${registeredAddressAId}`,
        )
        .set('Authorization', `Bearer ${accessTokenOrgA}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(registeredAddressAId);
    });
  });

  describe('PATCH /organizations/me/addresses/:id', () => {
    it('should update registered address line 1', async () => {
      const res = await request(app.getHttpServer())
        .patch(
          `/${API_PREFIX}/organizations/me/addresses/${registeredAddressAId}`,
        )
        .set('Authorization', `Bearer ${accessTokenOrgA}`)
        .send({
          addressLine1: '789 Updated Business Ave',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.addressLine1).toBe('789 Updated Business Ave');
    });
  });

  describe('Tenant Security & Isolation (IDOR)', () => {
    it('Tenant B should be denied when attempting to access Tenant A address', async () => {
      await request(app.getHttpServer())
        .get(
          `/${API_PREFIX}/organizations/me/addresses/${registeredAddressAId}`,
        )
        .set('Authorization', `Bearer ${accessTokenOrgB}`)
        .expect(404);
    });

    it('Tenant B should be denied when attempting to update Tenant A address', async () => {
      await request(app.getHttpServer())
        .patch(
          `/${API_PREFIX}/organizations/me/addresses/${registeredAddressAId}`,
        )
        .set('Authorization', `Bearer ${accessTokenOrgB}`)
        .send({
          addressLine1: 'Hacked Address Line',
        })
        .expect(404);
    });
  });

  describe('DELETE /organizations/me/addresses/:id', () => {
    it('should soft-delete billing address', async () => {
      const res = await request(app.getHttpServer())
        .delete(
          `/${API_PREFIX}/organizations/me/addresses/${billingAddressAId}`,
        )
        .set('Authorization', `Bearer ${accessTokenOrgA}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('should prevent soft-deleting the only registered address', async () => {
      await request(app.getHttpServer())
        .delete(
          `/${API_PREFIX}/organizations/me/addresses/${registeredAddressAId}`,
        )
        .set('Authorization', `Bearer ${accessTokenOrgA}`)
        .expect(400);
    });
  });
});
