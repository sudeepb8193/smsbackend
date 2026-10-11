import { PrismaClient } from '@prisma/client';
import { seedPermissions } from './permissions.seed';
import { seedAllOrganizationsRoles } from './roles.seed';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Starting SMS Module 03 Seed Execution ---');

  console.log('1. Seeding / Synchronizing Permission Catalog...');
  const permissionsCount = await seedPermissions(prisma);
  console.log(`Permission Catalog Seeded: ${permissionsCount} permissions registered.`);

  console.log('2. Initializing Predefined System Roles for Organizations...');
  await seedAllOrganizationsRoles(prisma);

  console.log('--- SMS Module 03 Seed Execution Finished Successfully ---');
}

main()
  .catch((e) => {
    console.error('Seed execution error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
