import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as supertest from 'supertest';
const request = (supertest as any).default || supertest;
import { AppModule } from '../src/app.module';
import { API_PREFIX } from '../src/config/api.config';
import { PrismaService } from '../src/database/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

describe('OrganizationContactModule (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessTokenOrgA: string;
  let accessTokenOrgB: string;
  let orgAId: string;
  let orgBId: string;
  let contactAId: string;

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
        organizationName: 'Contact Test Org A',
        fullName: 'Admin Contact A',
        email: `contact.admin.a.${Date.now()}@tenant-a.com`,
        password: 'Password123!',
      })
      .expect(201);

    accessTokenOrgA = regResA.body.data.accessToken;
    orgAId = regResA.body.data.user.organizationId;

    // Register Tenant B
    const regResB = await request(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/register`)
      .send({
        organizationName: 'Contact Test Org B',
        fullName: 'Admin Contact B',
        email: `contact.admin.b.${Date.now()}@tenant-b.com`,
        password: 'Password123!',
      })
      .expect(201);

    accessTokenOrgB = regResB.body.data.accessToken;
    orgBId = regResB.body.data.user.organizationId;
  });

  afterAll(async () => {
    if (prisma) {
      if (orgAId) {
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

  describe('POST /organizations/me/contacts', () => {
    it('should create a primary contact for Tenant A', async () => {
      const res = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/organizations/me/contacts`)
        .set('Authorization', `Bearer ${accessTokenOrgA}`)
        .send({
          contactType: 'primary',
          contactName: 'Main Helpdesk',
          email: 'primary@tenant-a.com',
          phoneCountryCode: '+91',
          phoneNumber: '9876543210',
          isDefaultPublic: true,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.contactType).toBe('primary');
      expect(res.body.data.email).toBe('primary@tenant-a.com');
      expect(res.body.data.emailVerified).toBe(false);
      expect(res.body.data.isDefaultPublic).toBe(true);
      contactAId = res.body.data.id;
    });

    it('should reject contact creation without email or phone', async () => {
      await request(app.getHttpServer())
        .post(`/${API_PREFIX}/organizations/me/contacts`)
        .set('Authorization', `Bearer ${accessTokenOrgA}`)
        .send({
          contactType: 'support',
          contactName: 'No Comm Method',
        })
        .expect(400);
    });
  });

  describe('GET /organizations/me/contacts', () => {
    it('should return contacts for Tenant A', async () => {
      const res = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/organizations/me/contacts`)
        .set('Authorization', `Bearer ${accessTokenOrgA}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(contactAId);
    });
  });

  describe('GET /organizations/me/contacts/:id', () => {
    it('should return single contact details', async () => {
      const res = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/organizations/me/contacts/${contactAId}`)
        .set('Authorization', `Bearer ${accessTokenOrgA}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(contactAId);
    });
  });

  describe('Tenant Security & Isolation (IDOR)', () => {
    it('Tenant B should be denied when attempting to access Tenant A contact', async () => {
      await request(app.getHttpServer())
        .get(`/${API_PREFIX}/organizations/me/contacts/${contactAId}`)
        .set('Authorization', `Bearer ${accessTokenOrgB}`)
        .expect(404);
    });

    it('Tenant B should be denied when attempting to update Tenant A contact', async () => {
      await request(app.getHttpServer())
        .patch(`/${API_PREFIX}/organizations/me/contacts/${contactAId}`)
        .set('Authorization', `Bearer ${accessTokenOrgB}`)
        .send({
          contactName: 'Hacked Name',
        })
        .expect(404);
    });
  });
});
