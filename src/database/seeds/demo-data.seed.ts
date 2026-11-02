import {
  PrismaClient,
  sms_staffDesignations_designationType,
  sms_staffSkillRatings_proficiencyLevel,
  sms_staffSkillRatings_verificationStatus,
  sms_commission_type,
  sms_branches_branchType,
  sms_branches_status,
  sms_staffBranchAssignments_assignmentType,
  sms_activeInactive,
  sms_services_status,
  sms_userStatusLogs_status,
} from '@prisma/client';

export async function seedDemoData(prisma: PrismaClient) {
  console.log('--- Starting Module 06 & Application Demo Data Seeding ---');

  // 1. Identify Target Organization: "Royal Touch Beauty Studio" or first org
  let org = await prisma.sms_organizations.findFirst({
    where: {
      OR: [
        { slug: { contains: 'royal-touch' } },
        { name: { contains: 'Royal Touch' } },
      ],
    },
  });

  if (!org) {
    org = await prisma.sms_organizations.findFirst();
  }

  if (!org) {
    console.warn('No organization found to seed demo data.');
    return;
  }

  const organizationId = org.id;
  console.log(`Using organization: ${org.name} (${organizationId})`);

  // Default password hash for seed users (Password123!)
  const defaultPasswordHash =
    '$2b$12$ey2mPYRd4XAzq83KErwrEOLnFE778K9aDmTC6eyaiC660cBUdGVgC';

  // 2. Fetch system roles for this organization
  const orgRoles = await prisma.sms_roles.findMany({
    where: { organizationId },
  });

  const getRole = (roleName: string) =>
    orgRoles.find(
      (r) => r.name.toLowerCase().trim() === roleName.toLowerCase().trim(),
    );

  const ownerRole = getRole('Owner');
  const branchManagerRole = getRole('Branch Manager');
  const serviceStaffRole = getRole('Service Staff');
  const accountantRole = getRole('Accountant');
  const frontDeskRole = getRole('Front Desk');

  // 3. Ensure Key Branches
  // Indiranagar Flagship Salon & Spa (Primary)
  let indiranagarBranch = await prisma.sms_branches.findFirst({
    where: { organizationId, code: 'BLR-01' },
  });
  if (!indiranagarBranch) {
    indiranagarBranch = await prisma.sms_branches.create({
      data: {
        organizationId,
        name: 'Indiranagar Flagship Salon & Spa',
        code: 'BLR-01',
        branchType: sms_branches_branchType.standard,
        status: sms_branches_status.active,
        launchedAt: new Date('2026-01-01'),
      },
    });
  }

  // Electronic City Branch
  let electronicCityBranch = await prisma.sms_branches.findFirst({
    where: { organizationId, code: 'BLR-02' },
  });
  if (!electronicCityBranch) {
    electronicCityBranch = await prisma.sms_branches.create({
      data: {
        organizationId,
        name: 'Electronic City Branch',
        code: 'BLR-02',
        branchType: sms_branches_branchType.standard,
        status: sms_branches_status.active,
        launchedAt: new Date('2026-02-01'),
      },
    });
  }

  // Whitefield Branch
  let whitefieldBranch = await prisma.sms_branches.findFirst({
    where: { organizationId, code: 'BLR-03' },
  });
  if (!whitefieldBranch) {
    whitefieldBranch = await prisma.sms_branches.create({
      data: {
        organizationId,
        name: 'Whitefield Branch',
        code: 'BLR-03',
        branchType: sms_branches_branchType.standard,
        status: sms_branches_status.active,
        launchedAt: new Date('2026-03-01'),
      },
    });
  }

  console.log('Branches verified:', {
    Indiranagar: indiranagarBranch.id,
    ElectronicCity: electronicCityBranch.id,
    Whitefield: whitefieldBranch.id,
  });

  // 4. Ensure Users for all standard roles
  // Owner user
  let ownerUser = await prisma.sms_users.findFirst({
    where: { organizationId, email: 'veeru@gmail.com' },
  });
  if (!ownerUser) {
    ownerUser = await prisma.sms_users.findFirst({
      where: { email: 'veeru@gmail.com' },
    });
  }

  // Ensure owner user is assigned to the organization's Owner role
  if (ownerUser && ownerRole) {
    const existingRole = await prisma.sms_userRoles.findFirst({
      where: { userId: ownerUser.id, roleId: ownerRole.id },
    });
    if (!existingRole) {
      await prisma.sms_userRoles.create({
        data: {
          userId: ownerUser.id,
          roleId: ownerRole.id,
          isPrimary: true,
        },
      });
    }
  }

  // Branch Manager user
  let managerUser = await prisma.sms_users.findFirst({
    where: { organizationId, email: 'maanger@gmail.com' },
  });
  if (!managerUser) {
    managerUser = await prisma.sms_users.findFirst({
      where: { email: 'maanger@gmail.com' },
    });
  }

  // Sarah Reddy user
  let sarahUser = await prisma.sms_users.findFirst({
    where: { organizationId, email: 'sarah@gmail.com' },
  });
  if (!sarahUser) {
    sarahUser = await prisma.sms_users.findFirst({
      where: { email: 'sarah@gmail.com' },
    });
  }

  // Rekha user
  let rekhaUser = await prisma.sms_users.findFirst({
    where: { organizationId, email: 'rekha@gmail.com' },
  });
  if (!rekhaUser) {
    rekhaUser = await prisma.sms_users.findFirst({
      where: { email: 'rekha@gmail.com' },
    });
  }

  // Accountant user
  let accountantUser = await prisma.sms_users.findFirst({
    where: { organizationId, email: 'accountant@gmail.com' },
  });
  if (!accountantUser) {
    accountantUser = await prisma.sms_users.create({
      data: {
        organizationId,
        displayName: 'Finance Accountant',
        email: 'accountant@gmail.com',
        phoneCountryCode: '+91',
        phoneNumber: '9876543210',
        passwordHash: defaultPasswordHash,
        status: sms_userStatusLogs_status.active,
      },
    });
    if (accountantRole) {
      await prisma.sms_userRoles.create({
        data: {
          userId: accountantUser.id,
          roleId: accountantRole.id,
          isPrimary: true,
        },
      });
    }
  }

  // Front Desk user
  let frontDeskUser = await prisma.sms_users.findFirst({
    where: { organizationId, email: 'frontdesk@gmail.com' },
  });
  if (!frontDeskUser) {
    frontDeskUser = await prisma.sms_users.create({
      data: {
        organizationId,
        displayName: 'Front Desk Host',
        email: 'frontdesk@gmail.com',
        phoneCountryCode: '+91',
        phoneNumber: '9876543211',
        passwordHash: defaultPasswordHash,
        status: sms_userStatusLogs_status.active,
      },
    });
    if (frontDeskRole) {
      await prisma.sms_userRoles.create({
        data: {
          userId: frontDeskUser.id,
          roleId: frontDeskRole.id,
          isPrimary: true,
        },
      });
    }
  }

  // Ensure branch assignments for Manager and Front Desk
  if (managerUser) {
    // Assign manager to Indiranagar and Electronic City
    for (const bId of [indiranagarBranch.id, electronicCityBranch.id]) {
      const existing = await prisma.sms_userBranchAssignments.findFirst({
        where: { userId: managerUser.id, branchId: bId },
      });
      if (!existing) {
        await prisma.sms_userBranchAssignments.create({
          data: {
            userId: managerUser.id,
            branchId: bId,
            isHomeBranch: bId === indiranagarBranch.id,
            effectiveFrom: new Date('2026-01-01'),
          },
        });
      }
    }
  }

  if (frontDeskUser) {
    const existing = await prisma.sms_userBranchAssignments.findFirst({
      where: { userId: frontDeskUser.id, branchId: indiranagarBranch.id },
    });
    if (!existing) {
      await prisma.sms_userBranchAssignments.create({
        data: {
          userId: frontDeskUser.id,
          branchId: indiranagarBranch.id,
          isHomeBranch: true,
          effectiveFrom: new Date('2026-01-01'),
        },
      });
    }
  }

  // 5. Ensure Service Categories
  let hairCategory = await prisma.sms_serviceCategories.findFirst({
    where: { organizationId, slug: 'hair-services-styling' },
  });
  if (!hairCategory) {
    hairCategory = await prisma.sms_serviceCategories.create({
      data: {
        organizationId,
        name: 'Hair Services & Styling',
        slug: 'hair-services-styling',
        description: 'Haircuts, styling, coloring and chemical treatments',
        status: sms_activeInactive.active,
        displayOrder: 1,
      },
    });
  }

  let spaCategory = await prisma.sms_serviceCategories.findFirst({
    where: { organizationId, slug: 'skin-wellness-spa' },
  });
  if (!spaCategory) {
    spaCategory = await prisma.sms_serviceCategories.create({
      data: {
        organizationId,
        name: 'Skin & Wellness Spa',
        slug: 'skin-wellness-spa',
        description: 'Skin facials, head massages and spa relaxation therapies',
        status: sms_activeInactive.active,
        displayOrder: 2,
      },
    });
  }

  // 6. Ensure Core Services
  // Haircut
  let haircutService = await prisma.sms_services.findFirst({
    where: { organizationId, slug: 'haircut' },
  });
  if (!haircutService) {
    haircutService = await prisma.sms_services.create({
      data: {
        organizationId,
        categoryId: hairCategory.id,
        name: 'Haircut',
        slug: 'haircut',
        description: 'Precision cut, blow dry and style by certified stylist',
        basePriceAmount: 500.0,
        baseDurationMinutes: 45,
        status: sms_services_status.active,
      },
    });
  }

  // Hair Coloring
  let coloringService = await prisma.sms_services.findFirst({
    where: { organizationId, slug: 'hair-coloring' },
  });
  if (!coloringService) {
    coloringService = await prisma.sms_services.create({
      data: {
        organizationId,
        categoryId: hairCategory.id,
        name: 'Hair Coloring',
        slug: 'hair-coloring',
        description: 'Root touch up or full coverage ammonia-free hair color',
        basePriceAmount: 2500.0,
        baseDurationMinutes: 90,
        status: sms_services_status.active,
      },
    });
  }

  // Balayage
  let balayageService = await prisma.sms_services.findFirst({
    where: { organizationId, slug: 'balayage' },
  });
  if (!balayageService) {
    balayageService = await prisma.sms_services.create({
      data: {
        organizationId,
        categoryId: hairCategory.id,
        name: 'Balayage',
        slug: 'balayage',
        description: 'Freehand French Balayage highlighting with gloss toner',
        basePriceAmount: 4500.0,
        baseDurationMinutes: 120,
        status: sms_services_status.active,
      },
    });
  }

  // Facial Treatment
  let facialService = await prisma.sms_services.findFirst({
    where: { organizationId, slug: 'facial-treatment' },
  });
  if (!facialService) {
    facialService = await prisma.sms_services.create({
      data: {
        organizationId,
        categoryId: spaCategory.id,
        name: 'Facial Treatment',
        slug: 'facial-treatment',
        description: 'Deep cleansing, exfoliation, and rejuvenating hydration mask',
        basePriceAmount: 1500.0,
        baseDurationMinutes: 60,
        status: sms_services_status.active,
      },
    });
  }

  // Head Massage
  let massageService = await prisma.sms_services.findFirst({
    where: { organizationId, slug: 'head-massage' },
  });
  if (!massageService) {
    massageService = await prisma.sms_services.create({
      data: {
        organizationId,
        categoryId: spaCategory.id,
        name: 'Head Massage',
        slug: 'head-massage',
        description: 'Traditional Ayurvedic warm oil scalp and shoulder massage',
        basePriceAmount: 800.0,
        baseDurationMinutes: 30,
        status: sms_services_status.active,
      },
    });
  }

  console.log('Services verified:', {
    Haircut: haircutService.id,
    Coloring: coloringService.id,
    Balayage: balayageService.id,
    Facial: facialService.id,
    Massage: massageService.id,
  });

  // 7. Seed Sarah Reddy (EMP-0001) – Exact prompt specification:
  // - HR designation: Senior Team Member
  // - Professional designation: Stylist (Primary), Colorist (Additional)
  // - Skill: Balayage (Expert, Manager Verified), Hair Coloring (Expert), Haircut (Master)
  // - Assigned services: Haircut, Hair Coloring, Balayage
  // - Branch availability: Indiranagar and Electronic City (Balayage at Whitefield Unavailable)
  // - Commission eligibility: Yes
  // - Staff-wide commission: 12%
  // - Balayage-specific commission: 15%

  const sarahStaff = await prisma.sms_staff.findFirst({
    where: { organizationId, employeeCode: 'EMP-0001' },
  });

  if (sarahStaff) {
    console.log(`Seeding Module 06 records for Sarah Reddy (${sarahStaff.id})...`);

    // Ensure branch assignments for Sarah (Indiranagar, Electronic City, Whitefield)
    for (const b of [
      { id: indiranagarBranch.id, type: sms_staffBranchAssignments_assignmentType.home },
      { id: electronicCityBranch.id, type: sms_staffBranchAssignments_assignmentType.secondary },
      { id: whitefieldBranch.id, type: sms_staffBranchAssignments_assignmentType.secondary },
    ]) {
      const existing = await prisma.sms_staffBranchAssignments.findFirst({
        where: { staffId: sarahStaff.id, branchId: b.id },
      });
      if (!existing) {
        await prisma.sms_staffBranchAssignments.create({
          data: {
            staffId: sarahStaff.id,
            branchId: b.id,
            assignmentType: b.type,
            effectiveFrom: new Date('2026-01-01'),
          },
        });
      }
    }

    // Task 6.1 – Designations: Stylist (Primary), Colorist (Additional)
    await prisma.sms_staffDesignations.deleteMany({
      where: { staffId: sarahStaff.id },
    });

    await prisma.sms_staffDesignations.create({
      data: {
        staffId: sarahStaff.id,
        designationType: sms_staffDesignations_designationType.stylist,
        customLabel: 'Stylist',
        isPrimary: true,
        yearsOfExperience: 6,
      },
    });

    await prisma.sms_staffDesignations.create({
      data: {
        staffId: sarahStaff.id,
        designationType: sms_staffDesignations_designationType.stylist,
        customLabel: 'Colorist',
        isPrimary: false,
        yearsOfExperience: 4,
      },
    });

    // Task 6.2 – Skills & Proficiency: Balayage (Expert, Verified), Hair Coloring, Precision Haircut
    await prisma.sms_staffSkillRatings.deleteMany({
      where: { staffId: sarahStaff.id },
    });

    await prisma.sms_staffSkillRatings.create({
      data: {
        staffId: sarahStaff.id,
        skillName: 'Balayage',
        proficiencyLevel: sms_staffSkillRatings_proficiencyLevel.expert,
        verificationStatus: sms_staffSkillRatings_verificationStatus.manager_verified,
        verifiedById: managerUser?.id || ownerUser?.id,
        verifiedAt: new Date(),
      },
    });

    await prisma.sms_staffSkillRatings.create({
      data: {
        staffId: sarahStaff.id,
        skillName: 'Hair Coloring',
        proficiencyLevel: sms_staffSkillRatings_proficiencyLevel.expert,
        verificationStatus: sms_staffSkillRatings_verificationStatus.manager_verified,
        verifiedById: managerUser?.id || ownerUser?.id,
        verifiedAt: new Date(),
      },
    });

    await prisma.sms_staffSkillRatings.create({
      data: {
        staffId: sarahStaff.id,
        skillName: 'Precision Haircut',
        proficiencyLevel: sms_staffSkillRatings_proficiencyLevel.master,
        verificationStatus: sms_staffSkillRatings_verificationStatus.manager_verified,
        verifiedById: managerUser?.id || ownerUser?.id,
        verifiedAt: new Date(),
      },
    });

    // Task 6.3 – Service Assignments: Haircut (40m), Hair Coloring (90m), Balayage (120m)
    // First clear old overrides and services
    const oldSarahServices = await prisma.sms_staffServices.findMany({
      where: { staffId: sarahStaff.id },
    });
    for (const s of oldSarahServices) {
      await prisma.sms_staffServiceBranchOverrides.deleteMany({
        where: { staffServiceId: s.id },
      });
    }
    await prisma.sms_staffServices.deleteMany({
      where: { staffId: sarahStaff.id },
    });

    const sarahHaircut = await prisma.sms_staffServices.create({
      data: {
        staffId: sarahStaff.id,
        serviceId: haircutService.id,
        durationOverrideMinutes: 40,
        isActive: true,
        assignedById: ownerUser?.id,
      },
    });

    const sarahColoring = await prisma.sms_staffServices.create({
      data: {
        staffId: sarahStaff.id,
        serviceId: coloringService.id,
        durationOverrideMinutes: 90,
        isActive: true,
        assignedById: ownerUser?.id,
      },
    });

    const sarahBalayage = await prisma.sms_staffServices.create({
      data: {
        staffId: sarahStaff.id,
        serviceId: balayageService.id,
        durationOverrideMinutes: 120,
        isActive: true,
        assignedById: ownerUser?.id,
      },
    });

    // Task 6.4 – Branch-Wise Availability: Balayage unavailable at Whitefield
    await prisma.sms_staffServiceBranchOverrides.create({
      data: {
        staffServiceId: sarahBalayage.id,
        branchId: whitefieldBranch.id,
        isAvailable: false,
        reason:
          'Balayage requires specialized coloring bay only available at Indiranagar & Electronic City',
        createdById: managerUser?.id || ownerUser?.id,
      },
    });

    // Task 6.5 – Commission: Staff-wide 12%, Balayage 15%
    await prisma.sms_staffCommissionRates.deleteMany({
      where: { staffId: sarahStaff.id },
    });

    // Staff-wide override (12%)
    await prisma.sms_staffCommissionRates.create({
      data: {
        staffId: sarahStaff.id,
        serviceId: null,
        isCommissionEligible: true,
        commissionType: sms_commission_type.percentage,
        commissionValue: 12.0,
        effectiveFrom: new Date('2026-01-01'),
        createdById: ownerUser?.id,
      },
    });

    // Balayage-specific override (15%)
    await prisma.sms_staffCommissionRates.create({
      data: {
        staffId: sarahStaff.id,
        serviceId: balayageService.id,
        isCommissionEligible: true,
        commissionType: sms_commission_type.percentage,
        commissionValue: 15.0,
        effectiveFrom: new Date('2026-01-01'),
        createdById: ownerUser?.id,
      },
    });

    console.log('Sarah Reddy Module 06 data seeded successfully.');
  }

  // 8. Seed Rekha (EMP-0003)
  const rekhaStaff = await prisma.sms_staff.findFirst({
    where: { organizationId, employeeCode: 'EMP-0003' },
  });

  if (rekhaStaff) {
    console.log(`Seeding Module 06 records for Rekha (${rekhaStaff.id})...`);

    // Ensure branch assignments for Rekha (Indiranagar, Electronic City)
    for (const b of [
      { id: indiranagarBranch.id, type: sms_staffBranchAssignments_assignmentType.home },
      { id: electronicCityBranch.id, type: sms_staffBranchAssignments_assignmentType.secondary },
    ]) {
      const existing = await prisma.sms_staffBranchAssignments.findFirst({
        where: { staffId: rekhaStaff.id, branchId: b.id },
      });
      if (!existing) {
        await prisma.sms_staffBranchAssignments.create({
          data: {
            staffId: rekhaStaff.id,
            branchId: b.id,
            assignmentType: b.type,
            effectiveFrom: new Date('2026-01-01'),
          },
        });
      }
    }

    // Task 6.1 – Designations: Senior Therapist (Primary), Skin Specialist (Additional)
    await prisma.sms_staffDesignations.deleteMany({
      where: { staffId: rekhaStaff.id },
    });

    await prisma.sms_staffDesignations.create({
      data: {
        staffId: rekhaStaff.id,
        designationType: sms_staffDesignations_designationType.therapist,
        customLabel: 'Senior Therapist',
        isPrimary: true,
        yearsOfExperience: 5,
      },
    });

    await prisma.sms_staffDesignations.create({
      data: {
        staffId: rekhaStaff.id,
        designationType: sms_staffDesignations_designationType.beautician,
        customLabel: 'Skin Specialist',
        isPrimary: false,
        yearsOfExperience: 3,
      },
    });

    // Task 6.2 – Skills & Proficiency: Facial Treatment (Master), Head Massage (Expert), Aromatherapy (Self-Declared)
    await prisma.sms_staffSkillRatings.deleteMany({
      where: { staffId: rekhaStaff.id },
    });

    await prisma.sms_staffSkillRatings.create({
      data: {
        staffId: rekhaStaff.id,
        skillName: 'Facial Treatment',
        proficiencyLevel: sms_staffSkillRatings_proficiencyLevel.master,
        verificationStatus: sms_staffSkillRatings_verificationStatus.manager_verified,
        verifiedById: managerUser?.id || ownerUser?.id,
        verifiedAt: new Date(),
      },
    });

    await prisma.sms_staffSkillRatings.create({
      data: {
        staffId: rekhaStaff.id,
        skillName: 'Head Massage',
        proficiencyLevel: sms_staffSkillRatings_proficiencyLevel.expert,
        verificationStatus: sms_staffSkillRatings_verificationStatus.manager_verified,
        verifiedById: managerUser?.id || ownerUser?.id,
        verifiedAt: new Date(),
      },
    });

    await prisma.sms_staffSkillRatings.create({
      data: {
        staffId: rekhaStaff.id,
        skillName: 'Aromatherapy',
        proficiencyLevel: sms_staffSkillRatings_proficiencyLevel.intermediate,
        verificationStatus: sms_staffSkillRatings_verificationStatus.self_declared,
      },
    });

    // Task 6.3 – Service Assignments: Facial Treatment, Head Massage
    const oldRekhaServices = await prisma.sms_staffServices.findMany({
      where: { staffId: rekhaStaff.id },
    });
    for (const s of oldRekhaServices) {
      await prisma.sms_staffServiceBranchOverrides.deleteMany({
        where: { staffServiceId: s.id },
      });
    }
    await prisma.sms_staffServices.deleteMany({
      where: { staffId: rekhaStaff.id },
    });

    await prisma.sms_staffServices.create({
      data: {
        staffId: rekhaStaff.id,
        serviceId: facialService.id,
        durationOverrideMinutes: 60,
        isActive: true,
        assignedById: ownerUser?.id,
      },
    });

    await prisma.sms_staffServices.create({
      data: {
        staffId: rekhaStaff.id,
        serviceId: massageService.id,
        durationOverrideMinutes: 30,
        isActive: true,
        assignedById: ownerUser?.id,
      },
    });

    // Task 6.5 – Commission: Staff-wide 10%
    await prisma.sms_staffCommissionRates.deleteMany({
      where: { staffId: rekhaStaff.id },
    });

    await prisma.sms_staffCommissionRates.create({
      data: {
        staffId: rekhaStaff.id,
        serviceId: null,
        isCommissionEligible: true,
        commissionType: sms_commission_type.percentage,
        commissionValue: 10.0,
        effectiveFrom: new Date('2026-01-01'),
        createdById: ownerUser?.id,
      },
    });

    console.log('Rekha Module 06 data seeded successfully.');
  }

  console.log('--- Module 06 Demo Data Seeding Completed Successfully ---');
}

