-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'FRONT_DESK', 'SERVICE_STAFF', 'INVENTORY_MANAGER', 'MARKETING_MANAGER', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "sms_organizations_businessType" AS ENUM ('salon', 'spa', 'unisex_salon', 'barbershop', 'wellness_center', 'other');

-- CreateEnum
CREATE TYPE "sms_organizations_status" AS ENUM ('onboarding', 'active', 'suspended', 'inactive');

-- CreateEnum
CREATE TYPE "sms_organizationContacts_contactType" AS ENUM ('primary', 'support', 'billing', 'emergency');

-- CreateEnum
CREATE TYPE "sms_organizationAddresses_addressType" AS ENUM ('registered', 'billing');

-- CreateEnum
CREATE TYPE "sms_organizationTaxProfiles_taxIdentifierType" AS ENUM ('gstin', 'vat', 'ein', 'tin', 'pan', 'other');

-- CreateEnum
CREATE TYPE "sms_organizationTaxProfiles_verificationStatus" AS ENUM ('pending', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "sms_organizationSettings_currencySymbolPosition" AS ENUM ('prefix', 'suffix');

-- CreateEnum
CREATE TYPE "sms_organizationSettings_timeFormat" AS ENUM ('h12', 'h24');

-- CreateEnum
CREATE TYPE "sms_organizationSettings_firstDayOfWeek" AS ENUM ('sunday', 'monday');

-- CreateEnum
CREATE TYPE "sms_holidays_status" AS ENUM ('active', 'cancelled');

-- CreateEnum
CREATE TYPE "sms_branches_branchType" AS ENUM ('flagship', 'standard', 'kiosk');

-- CreateEnum
CREATE TYPE "sms_branches_status" AS ENUM ('draft', 'active', 'temporarily_closed', 'permanently_closed');

-- CreateEnum
CREATE TYPE "sms_branchManagerAssignments_assignmentType" AS ENUM ('primary', 'assistant');

-- CreateEnum
CREATE TYPE "sms_roles_roleType" AS ENUM ('system', 'custom');

-- CreateEnum
CREATE TYPE "sms_roles_status" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "sms_permissions_action" AS ENUM ('create', 'view', 'edit', 'delete', 'approve', 'export', 'print');

-- CreateEnum
CREATE TYPE "sms_rolePermissions_scope" AS ENUM ('own_branch', 'restricted_branches', 'all_branches');

-- CreateEnum
CREATE TYPE "sms_staffPermissionOverrides_overrideType" AS ENUM ('grant', 'revoke');

-- CreateEnum
CREATE TYPE "sms_userRoles_none" AS ENUM ('placeholder');

-- CreateEnum
CREATE TYPE "sms_userStatusLogs_status" AS ENUM ('pending_invite', 'active', 'suspended', 'deactivated');

-- CreateEnum
CREATE TYPE "sms_userPasswordResets_deliveryMethod" AS ENUM ('email', 'sms');

-- CreateEnum
CREATE TYPE "sms_userPasswordResets_initiatedBy" AS ENUM ('self', 'admin');

-- CreateEnum
CREATE TYPE "sms_userTwoFactorSettings_method" AS ENUM ('totp', 'sms');

-- CreateEnum
CREATE TYPE "sms_staff_gender" AS ENUM ('male', 'female', 'other', 'prefer_not_to_say');

-- CreateEnum
CREATE TYPE "sms_staff_employmentStatus" AS ENUM ('active', 'on_leave', 'suspended', 'terminated');

-- CreateEnum
CREATE TYPE "sms_staffContacts_maritalStatus" AS ENUM ('single', 'married', 'other', 'prefer_not_to_say');

-- CreateEnum
CREATE TYPE "sms_staffEmploymentHistory_employmentType" AS ENUM ('full_time', 'part_time', 'contract', 'intern');

-- CreateEnum
CREATE TYPE "sms_staffEmploymentHistory_changeReason" AS ENUM ('initial_hire', 'promotion', 'transfer', 'restructure', 'correction');

-- CreateEnum
CREATE TYPE "sms_staffQualifications_recordType" AS ENUM ('formal_qualification', 'skill_tag');

-- CreateEnum
CREATE TYPE "sms_staffDocuments_category" AS ENUM ('id_proof', 'employment_contract', 'offer_letter', 'background_check', 'other');

-- CreateEnum
CREATE TYPE "sms_staffDocuments_status" AS ENUM ('active', 'expired', 'superseded');

-- CreateEnum
CREATE TYPE "sms_staffBranchAssignments_assignmentType" AS ENUM ('home', 'secondary');

-- CreateEnum
CREATE TYPE "sms_staffDesignations_designationType" AS ENUM ('stylist', 'beautician', 'makeup_artist', 'hairdresser', 'therapist', 'nail_technician', 'other');

-- CreateEnum
CREATE TYPE "sms_staffSkillRatings_proficiencyLevel" AS ENUM ('beginner', 'intermediate', 'expert', 'master');

-- CreateEnum
CREATE TYPE "sms_staffSkillRatings_verificationStatus" AS ENUM ('self_declared', 'manager_verified');

-- CreateEnum
CREATE TYPE "sms_commission_type" AS ENUM ('percentage', 'fixed');

-- CreateEnum
CREATE TYPE "sms_shiftTemplates_status" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "sms_staffScheduleOverrides_overrideType" AS ENUM ('extra_shift', 'shift_change', 'early_leave', 'late_arrival', 'day_off');

-- CreateEnum
CREATE TYPE "sms_approvalStatus" AS ENUM ('not_required', 'pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "sms_staffAvailabilityPreferences_preferenceType" AS ENUM ('preferred', 'avoid', 'unavailable');

-- CreateEnum
CREATE TYPE "sms_staffBlockedTime_reasonCategory" AS ENUM ('training', 'meeting', 'personal', 'other');

-- CreateEnum
CREATE TYPE "sms_checkinMethod" AS ENUM ('biometric', 'geofenced_app', 'manual', 'admin_entry');

-- CreateEnum
CREATE TYPE "sms_staffAttendance_status" AS ENUM ('present', 'late', 'early_exit', 'half_day', 'absent', 'on_leave', 'holiday');

-- CreateEnum
CREATE TYPE "sms_staffAttendanceCorrections_status" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "sms_attendancePeriodApprovals_status" AS ENUM ('pending', 'approved', 'reopened');

-- CreateEnum
CREATE TYPE "sms_leaveTypes_accrualMethod" AS ENUM ('annual_grant', 'monthly_accrual', 'none');

-- CreateEnum
CREATE TYPE "sms_leaveTypes_applicableGender" AS ENUM ('all', 'female', 'male');

-- CreateEnum
CREATE TYPE "sms_staffLeaveRequests_halfDayPeriod" AS ENUM ('morning', 'afternoon');

-- CreateEnum
CREATE TYPE "sms_staffLeaveRequests_status" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "sms_leaveApprovalLogs_action" AS ENUM ('submitted', 'approved', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "sms_leaveBlackoutPeriods_restrictionType" AS ENUM ('block_all', 'limit_percentage');

-- CreateEnum
CREATE TYPE "sms_activeInactive" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "sms_serviceCategoryMedia_mediaType" AS ENUM ('thumbnail', 'banner', 'custom_icon');

-- CreateEnum
CREATE TYPE "sms_services_status" AS ENUM ('active', 'inactive', 'discontinued');

-- CreateEnum
CREATE TYPE "sms_serviceMedia_mediaType" AS ENUM ('thumbnail', 'gallery');

-- CreateEnum
CREATE TYPE "sms_serviceRequiredResources_requirementLevel" AS ENUM ('required', 'preferred');

-- CreateEnum
CREATE TYPE "sms_servicePackages_usageLimitType" AS ENUM ('fixed_count', 'unlimited_within_validity');

-- CreateEnum
CREATE TYPE "sms_customerPackagePurchases_status" AS ENUM ('active', 'expired', 'fully_used', 'cancelled');

-- CreateEnum
CREATE TYPE "sms_addons_addonType" AS ENUM ('service_addon', 'product_addon');

-- CreateEnum
CREATE TYPE "sms_resourceTypes_category" AS ENUM ('room', 'chair', 'bed', 'makeup_station', 'equipment', 'other');

-- CreateEnum
CREATE TYPE "sms_resources_status" AS ENUM ('active', 'under_maintenance', 'retired');

-- CreateEnum
CREATE TYPE "sms_resourceMaintenanceLogs_maintenanceType" AS ENUM ('scheduled', 'breakdown', 'inspection');

-- CreateEnum
CREATE TYPE "sms_resourceMaintenanceLogs_status" AS ENUM ('open', 'in_progress', 'completed');

-- CreateEnum
CREATE TYPE "sms_customers_registrationSource" AS ENUM ('walk_in', 'online_portal', 'phone', 'staff_added', 'import');

-- CreateEnum
CREATE TYPE "sms_customers_status" AS ENUM ('active', 'inactive', 'blocked', 'do_not_contact');

-- CreateEnum
CREATE TYPE "sms_customerAddresses_addressType" AS ENUM ('home', 'work', 'other');

-- CreateEnum
CREATE TYPE "sms_customerPreferences_communicationChannel" AS ENUM ('sms', 'email', 'whatsapp', 'push', 'none');

-- CreateEnum
CREATE TYPE "sms_customerNotes_visibility" AS ENUM ('all_staff', 'managers_only');

-- CreateTable
CREATE TABLE "sms_addonBranchAvailability" (
    "id" BIGSERIAL NOT NULL,
    "addonId" BIGINT NOT NULL,
    "branchId" BIGINT NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "autoSyncWithStock" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_addonBranchAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_addonCommissionDefaults" (
    "id" BIGSERIAL NOT NULL,
    "addonId" BIGINT NOT NULL,
    "isCommissionEligible" BOOLEAN NOT NULL DEFAULT true,
    "commissionType" "sms_commission_type" NOT NULL DEFAULT 'percentage',
    "commissionValue" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_addonCommissionDefaults_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_addonServiceMappings" (
    "id" BIGSERIAL NOT NULL,
    "addonId" BIGINT NOT NULL,
    "serviceId" BIGINT NOT NULL,
    "isRecommended" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_addonServiceMappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_addons" (
    "id" BIGSERIAL NOT NULL,
    "organizationId" BIGINT NOT NULL,
    "addonType" "sms_addons_addonType" NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "description" VARCHAR(255),
    "imageUrl" VARCHAR(500),
    "priceAmount" DECIMAL(10,2) NOT NULL,
    "durationMinutes" SMALLINT,
    "linkedProductId" BIGINT,
    "onlineBookingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "status" "sms_activeInactive" NOT NULL DEFAULT 'active',
    "createdById" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "sms_addons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_attendancePeriodApprovals" (
    "id" BIGSERIAL NOT NULL,
    "staffId" BIGINT NOT NULL,
    "branchId" BIGINT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "status" "sms_attendancePeriodApprovals_status" NOT NULL DEFAULT 'pending',
    "approvedById" BIGINT,
    "approvedAt" TIMESTAMP(3),
    "reopenedReason" VARCHAR(255),
    "reopenedById" BIGINT,
    "reopenedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_attendancePeriodApprovals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_attendancePolicies" (
    "id" BIGSERIAL NOT NULL,
    "organizationId" BIGINT NOT NULL,
    "branchId" BIGINT,
    "lateGraceMinutes" SMALLINT NOT NULL DEFAULT 10,
    "earlyExitGraceMinutes" SMALLINT NOT NULL DEFAULT 10,
    "halfDayThresholdMinutes" SMALLINT NOT NULL DEFAULT 240,
    "overtimeThresholdMinutes" SMALLINT NOT NULL DEFAULT 15,
    "overtimeRequiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "absentCutoffMinutes" SMALLINT NOT NULL DEFAULT 120,
    "allowedCheckinMethods" VARCHAR(150) NOT NULL DEFAULT 'biometric,geofenced_app,manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_attendancePolicies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_branchAddresses" (
    "id" BIGSERIAL NOT NULL,
    "branchId" BIGINT NOT NULL,
    "addressLine1" VARCHAR(200) NOT NULL,
    "addressLine2" VARCHAR(200),
    "landmark" VARCHAR(120),
    "city" VARCHAR(80) NOT NULL,
    "state" VARCHAR(80) NOT NULL,
    "postalCode" VARCHAR(20) NOT NULL,
    "countryCode" CHAR(2) NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "mapsUrl" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_branchAddresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_branchContacts" (
    "id" BIGSERIAL NOT NULL,
    "branchId" BIGINT NOT NULL,
    "phoneCountryCode" VARCHAR(5),
    "phoneNumber" VARCHAR(20),
    "phoneVerifiedAt" TIMESTAMP(3),
    "whatsappNumber" VARCHAR(20),
    "email" VARCHAR(150),
    "emailVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_branchContacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_branchManagerAssignments" (
    "id" BIGSERIAL NOT NULL,
    "branchId" BIGINT NOT NULL,
    "staffId" BIGINT NOT NULL,
    "assignmentType" "sms_branchManagerAssignments_assignmentType" NOT NULL DEFAULT 'primary',
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "changeReason" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_branchManagerAssignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_branchScheduleOverrides" (
    "id" BIGSERIAL NOT NULL,
    "branchId" BIGINT NOT NULL,
    "overrideDate" DATE NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "openTime" TIME,
    "closeTime" TIME,
    "reason" VARCHAR(255),
    "createdById" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_branchScheduleOverrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_branchSettings" (
    "id" BIGSERIAL NOT NULL,
    "branchId" BIGINT NOT NULL,
    "onlineBookingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "maxConcurrentAppointments" SMALLINT,
    "minBookingLeadMinutes" INTEGER NOT NULL DEFAULT 0,
    "maxBookingAdvanceDays" INTEGER NOT NULL DEFAULT 90,
    "walkinQueueEnabled" BOOLEAN NOT NULL DEFAULT true,
    "giftCardsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "membershipSalesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "onlinePaymentsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "cancellationPolicyText" TEXT,
    "noShowFeeAmount" DECIMAL(10,2),
    "taxRateOverridePercentage" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_branchSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_branches" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "organizationId" BIGINT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "branchType" "sms_branches_branchType" NOT NULL DEFAULT 'standard',
    "coverImageUrl" VARCHAR(500),
    "status" "sms_branches_status" NOT NULL DEFAULT 'draft',
    "launchedAt" DATE,
    "createdById" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "sms_branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_businessHours" (
    "id" BIGSERIAL NOT NULL,
    "organizationId" BIGINT NOT NULL,
    "branchId" BIGINT,
    "dayOfWeek" SMALLINT NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "openTime" TIME,
    "closeTime" TIME,
    "breakStartTime" TIME,
    "breakEndTime" TIME,
    "spansMidnight" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_businessHours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_customerAddresses" (
    "id" BIGSERIAL NOT NULL,
    "customerId" BIGINT NOT NULL,
    "addressType" "sms_customerAddresses_addressType" NOT NULL DEFAULT 'home',
    "addressLine1" VARCHAR(200) NOT NULL,
    "addressLine2" VARCHAR(200),
    "city" VARCHAR(80) NOT NULL,
    "state" VARCHAR(80),
    "postalCode" VARCHAR(20),
    "countryCode" CHAR(2) NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_customerAddresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_customerMergeLogs" (
    "id" BIGSERIAL NOT NULL,
    "survivingCustomerId" BIGINT NOT NULL,
    "mergedCustomerId" BIGINT NOT NULL,
    "mergedFieldsSummary" TEXT,
    "reason" VARCHAR(255),
    "mergedById" BIGINT NOT NULL,
    "mergedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_customerMergeLogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_customerNotes" (
    "id" BIGSERIAL NOT NULL,
    "customerId" BIGINT NOT NULL,
    "noteText" TEXT NOT NULL,
    "visibility" "sms_customerNotes_visibility" NOT NULL DEFAULT 'all_staff',
    "createdById" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_customerNotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_customerPackagePurchases" (
    "id" BIGSERIAL NOT NULL,
    "customerId" BIGINT NOT NULL,
    "packageId" BIGINT NOT NULL,
    "branchId" BIGINT NOT NULL,
    "invoiceId" BIGINT,
    "pricePaidAmount" DECIMAL(10,2) NOT NULL,
    "purchaseDate" DATE NOT NULL,
    "expiryDate" DATE NOT NULL,
    "status" "sms_customerPackagePurchases_status" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_customerPackagePurchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_customerPackageUsageLogs" (
    "id" BIGSERIAL NOT NULL,
    "packagePurchaseId" BIGINT NOT NULL,
    "serviceId" BIGINT NOT NULL,
    "appointmentId" BIGINT,
    "quantityUsed" SMALLINT NOT NULL DEFAULT 1,
    "isReversed" BOOLEAN NOT NULL DEFAULT false,
    "reversedAt" TIMESTAMP(3),
    "recordedById" BIGINT NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_customerPackageUsageLogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_customerPreferences" (
    "id" BIGSERIAL NOT NULL,
    "customerId" BIGINT NOT NULL,
    "preferredBranchId" BIGINT,
    "preferredStaffId" BIGINT,
    "preferredCommunicationChannel" "sms_customerPreferences_communicationChannel" NOT NULL DEFAULT 'sms',
    "languagePreference" VARCHAR(10) NOT NULL DEFAULT 'en',
    "marketingOptIn" BOOLEAN NOT NULL DEFAULT true,
    "allergyNotes" TEXT,
    "patchTestOnFile" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_customerPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_customerTags" (
    "id" BIGSERIAL NOT NULL,
    "organizationId" BIGINT NOT NULL,
    "customerId" BIGINT NOT NULL,
    "tagName" VARCHAR(50) NOT NULL,
    "tagColor" VARCHAR(20),
    "addedById" BIGINT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_customerTags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_customers" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "organizationId" BIGINT NOT NULL,
    "customerCode" VARCHAR(30) NOT NULL,
    "fullName" VARCHAR(150) NOT NULL,
    "phoneCountryCode" VARCHAR(5),
    "phoneNumber" VARCHAR(20),
    "phoneVerifiedAt" TIMESTAMP(3),
    "email" VARCHAR(150),
    "emailVerifiedAt" TIMESTAMP(3),
    "dateOfBirth" DATE,
    "gender" "sms_staff_gender",
    "profilePhotoUrl" VARCHAR(500),
    "registrationSource" "sms_customers_registrationSource" NOT NULL DEFAULT 'walk_in',
    "registeredBranchId" BIGINT,
    "status" "sms_customers_status" NOT NULL DEFAULT 'active',
    "createdById" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "sms_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_holidays" (
    "id" BIGSERIAL NOT NULL,
    "organizationId" BIGINT NOT NULL,
    "branchId" BIGINT,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(255),
    "holidayDate" DATE NOT NULL,
    "isRecurringAnnually" BOOLEAN NOT NULL DEFAULT false,
    "status" "sms_holidays_status" NOT NULL DEFAULT 'active',
    "createdById" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_leaveApprovalLogs" (
    "id" BIGSERIAL NOT NULL,
    "leaveRequestId" BIGINT NOT NULL,
    "action" "sms_leaveApprovalLogs_action" NOT NULL,
    "actorId" BIGINT NOT NULL,
    "notes" VARCHAR(255),
    "actionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_leaveApprovalLogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_leaveBlackoutPeriods" (
    "id" BIGSERIAL NOT NULL,
    "organizationId" BIGINT NOT NULL,
    "branchId" BIGINT,
    "name" VARCHAR(120) NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "restrictionType" "sms_leaveBlackoutPeriods_restrictionType" NOT NULL DEFAULT 'block_all',
    "maxPercentageStaffOnLeave" DECIMAL(5,2),
    "appliesToLeaveTypeIds" VARCHAR(255),
    "reason" VARCHAR(255),
    "createdById" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_leaveBlackoutPeriods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_leaveTypes" (
    "id" BIGSERIAL NOT NULL,
    "organizationId" BIGINT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT true,
    "accrualMethod" "sms_leaveTypes_accrualMethod" NOT NULL DEFAULT 'annual_grant',
    "annualEntitlementDays" DECIMAL(5,1) NOT NULL DEFAULT 0,
    "monthlyAccrualDays" DECIMAL(4,2),
    "maxCarryForwardDays" DECIMAL(5,1) NOT NULL DEFAULT 0,
    "documentRequiredAfterDays" DECIMAL(4,1),
    "minNoticeDays" SMALLINT NOT NULL DEFAULT 0,
    "applicableGender" "sms_leaveTypes_applicableGender" NOT NULL DEFAULT 'all',
    "status" "sms_activeInactive" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_leaveTypes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_organizationAddresses" (
    "id" BIGSERIAL NOT NULL,
    "organizationId" BIGINT NOT NULL,
    "addressType" "sms_organizationAddresses_addressType" NOT NULL,
    "addressLine1" VARCHAR(200) NOT NULL,
    "addressLine2" VARCHAR(200),
    "landmark" VARCHAR(120),
    "city" VARCHAR(80) NOT NULL,
    "state" VARCHAR(80) NOT NULL,
    "postalCode" VARCHAR(20) NOT NULL,
    "countryCode" CHAR(2) NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_organizationAddresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_organizationContacts" (
    "id" BIGSERIAL NOT NULL,
    "organizationId" BIGINT NOT NULL,
    "contactType" "sms_organizationContacts_contactType" NOT NULL,
    "fullName" VARCHAR(120),
    "designation" VARCHAR(80),
    "phoneCountryCode" VARCHAR(5),
    "phoneNumber" VARCHAR(20),
    "phoneVerifiedAt" TIMESTAMP(3),
    "email" VARCHAR(150),
    "emailVerifiedAt" TIMESTAMP(3),
    "isDefaultPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_organizationContacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_organizationSettings" (
    "id" BIGSERIAL NOT NULL,
    "organizationId" BIGINT NOT NULL,
    "defaultCurrencyCode" CHAR(3) NOT NULL DEFAULT 'USD',
    "currencySymbolPosition" "sms_organizationSettings_currencySymbolPosition" NOT NULL DEFAULT 'prefix',
    "currencyDecimalPlaces" SMALLINT NOT NULL DEFAULT 2,
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'UTC',
    "dateFormat" VARCHAR(20) NOT NULL DEFAULT 'DD/MM/YYYY',
    "timeFormat" "sms_organizationSettings_timeFormat" NOT NULL DEFAULT 'h12',
    "firstDayOfWeek" "sms_organizationSettings_firstDayOfWeek" NOT NULL DEFAULT 'monday',
    "languageCode" VARCHAR(10) NOT NULL DEFAULT 'en',
    "fiscalYearStartMonth" SMALLINT NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_organizationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_organizationTaxProfiles" (
    "id" BIGSERIAL NOT NULL,
    "organizationId" BIGINT NOT NULL,
    "taxIdentifierType" "sms_organizationTaxProfiles_taxIdentifierType" NOT NULL,
    "taxIdentifierNumber" VARCHAR(40) NOT NULL,
    "registeredBusinessName" VARCHAR(150) NOT NULL,
    "taxRegistrationDate" DATE,
    "isTaxExempt" BOOLEAN NOT NULL DEFAULT false,
    "documentUrl" VARCHAR(500),
    "verificationStatus" "sms_organizationTaxProfiles_verificationStatus" NOT NULL DEFAULT 'pending',
    "verificationNotes" VARCHAR(255),
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_organizationTaxProfiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_organizations" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "legalName" VARCHAR(150),
    "slug" VARCHAR(160) NOT NULL,
    "businessType" "sms_organizations_businessType" NOT NULL DEFAULT 'salon',
    "logoUrl" VARCHAR(500),
    "faviconUrl" VARCHAR(500),
    "brandPrimaryColor" CHAR(7),
    "brandSecondaryColor" CHAR(7),
    "status" "sms_organizations_status" NOT NULL DEFAULT 'onboarding',
    "onboardingStep" SMALLINT NOT NULL DEFAULT 0,
    "createdById" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "sms_organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_permissions" (
    "id" BIGSERIAL NOT NULL,
    "moduleCode" VARCHAR(60) NOT NULL,
    "moduleLabel" VARCHAR(100) NOT NULL,
    "action" "sms_permissions_action" NOT NULL,
    "permissionKey" VARCHAR(120) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "description" VARCHAR(255),
    "isLegacy" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_resourceBlockedTime" (
    "id" BIGSERIAL NOT NULL,
    "resourceId" BIGINT NOT NULL,
    "branchId" BIGINT NOT NULL,
    "blockDate" DATE NOT NULL,
    "startTime" TIME NOT NULL,
    "endTime" TIME NOT NULL,
    "reasonCategory" "sms_staffBlockedTime_reasonCategory" NOT NULL DEFAULT 'other',
    "note" VARCHAR(255),
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceEndDate" DATE,
    "createdById" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_resourceBlockedTime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_resourceMaintenanceLogs" (
    "id" BIGSERIAL NOT NULL,
    "resourceId" BIGINT NOT NULL,
    "maintenanceType" "sms_resourceMaintenanceLogs_maintenanceType" NOT NULL,
    "reportedIssue" VARCHAR(255),
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "costAmount" DECIMAL(10,2),
    "vendorName" VARCHAR(150),
    "status" "sms_resourceMaintenanceLogs_status" NOT NULL DEFAULT 'open',
    "createdById" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_resourceMaintenanceLogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_resourceTypes" (
    "id" BIGSERIAL NOT NULL,
    "organizationId" BIGINT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "category" "sms_resourceTypes_category" NOT NULL,
    "description" VARCHAR(255),
    "iconKey" VARCHAR(50),
    "status" "sms_activeInactive" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_resourceTypes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_resources" (
    "id" BIGSERIAL NOT NULL,
    "organizationId" BIGINT NOT NULL,
    "branchId" BIGINT NOT NULL,
    "resourceTypeId" BIGINT NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "capacity" SMALLINT NOT NULL DEFAULT 1,
    "status" "sms_resources_status" NOT NULL DEFAULT 'active',
    "notes" VARCHAR(255),
    "createdById" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "sms_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_roleBranchRestrictions" (
    "id" BIGSERIAL NOT NULL,
    "roleId" BIGINT NOT NULL,
    "moduleCode" VARCHAR(60) NOT NULL,
    "branchId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_roleBranchRestrictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_rolePermissions" (
    "id" BIGSERIAL NOT NULL,
    "roleId" BIGINT NOT NULL,
    "permissionId" BIGINT NOT NULL,
    "scope" "sms_rolePermissions_scope" NOT NULL DEFAULT 'own_branch',
    "grantedById" BIGINT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_rolePermissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_roles" (
    "id" BIGSERIAL NOT NULL,
    "organizationId" BIGINT,
    "name" VARCHAR(80) NOT NULL,
    "slug" VARCHAR(90) NOT NULL,
    "description" VARCHAR(255),
    "roleType" "sms_roles_roleType" NOT NULL DEFAULT 'custom',
    "clonedFromRoleId" BIGINT,
    "status" "sms_roles_status" NOT NULL DEFAULT 'active',
    "createdById" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "sms_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_serviceBranchAvailability" (
    "id" BIGSERIAL NOT NULL,
    "serviceId" BIGINT NOT NULL,
    "branchId" BIGINT NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdById" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_serviceBranchAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_serviceBranchPricing" (
    "id" BIGSERIAL NOT NULL,
    "serviceId" BIGINT NOT NULL,
    "branchId" BIGINT NOT NULL,
    "priceAmount" DECIMAL(10,2) NOT NULL,
    "durationOverrideMinutes" SMALLINT,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdById" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_serviceBranchPricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_serviceCategories" (
    "id" BIGSERIAL NOT NULL,
    "organizationId" BIGINT NOT NULL,
    "parentCategoryId" BIGINT,
    "name" VARCHAR(80) NOT NULL,
    "slug" VARCHAR(90) NOT NULL,
    "description" VARCHAR(255),
    "iconKey" VARCHAR(50),
    "displayOrder" SMALLINT NOT NULL DEFAULT 0,
    "status" "sms_activeInactive" NOT NULL DEFAULT 'active',
    "createdById" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "sms_serviceCategories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_serviceCategoryBranchSettings" (
    "id" BIGSERIAL NOT NULL,
    "categoryId" BIGINT NOT NULL,
    "branchId" BIGINT NOT NULL,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "branchDisplayOrder" SMALLINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_serviceCategoryBranchSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_serviceCategoryMedia" (
    "id" BIGSERIAL NOT NULL,
    "categoryId" BIGINT NOT NULL,
    "mediaType" "sms_serviceCategoryMedia_mediaType" NOT NULL,
    "mediaUrl" VARCHAR(500) NOT NULL,
    "altText" VARCHAR(150),
    "displayOrder" SMALLINT NOT NULL DEFAULT 0,
    "uploadedById" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_serviceCategoryMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_serviceCommissionDefaults" (
    "id" BIGSERIAL NOT NULL,
    "serviceId" BIGINT NOT NULL,
    "isCommissionEligible" BOOLEAN NOT NULL DEFAULT true,
    "commissionType" "sms_commission_type" NOT NULL DEFAULT 'percentage',
    "commissionValue" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_serviceCommissionDefaults_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_serviceMedia" (
    "id" BIGSERIAL NOT NULL,
    "serviceId" BIGINT NOT NULL,
    "mediaType" "sms_serviceMedia_mediaType" NOT NULL,
    "mediaUrl" VARCHAR(500) NOT NULL,
    "altText" VARCHAR(150),
    "displayOrder" SMALLINT NOT NULL DEFAULT 0,
    "uploadedById" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_serviceMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_servicePackageBranchAvailability" (
    "id" BIGSERIAL NOT NULL,
    "packageId" BIGINT NOT NULL,
    "branchId" BIGINT NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_servicePackageBranchAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_servicePackageItems" (
    "id" BIGSERIAL NOT NULL,
    "packageId" BIGINT NOT NULL,
    "serviceId" BIGINT NOT NULL,
    "quantityIncluded" SMALLINT NOT NULL DEFAULT 1,
    "servicePriceSnapshot" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_servicePackageItems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_servicePackages" (
    "id" BIGSERIAL NOT NULL,
    "organizationId" BIGINT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "imageUrl" VARCHAR(500),
    "packagePriceAmount" DECIMAL(10,2) NOT NULL,
    "validityDays" SMALLINT NOT NULL DEFAULT 90,
    "usageLimitType" "sms_servicePackages_usageLimitType" NOT NULL DEFAULT 'fixed_count',
    "status" "sms_activeInactive" NOT NULL DEFAULT 'active',
    "createdById" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "sms_servicePackages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_serviceRequiredProducts" (
    "id" BIGSERIAL NOT NULL,
    "serviceId" BIGINT NOT NULL,
    "productId" BIGINT NOT NULL,
    "quantityPerService" DECIMAL(8,2) NOT NULL,
    "unit" VARCHAR(20) NOT NULL,
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_serviceRequiredProducts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_serviceRequiredResources" (
    "id" BIGSERIAL NOT NULL,
    "serviceId" BIGINT NOT NULL,
    "resourceTypeId" BIGINT NOT NULL,
    "quantityRequired" SMALLINT NOT NULL DEFAULT 1,
    "requirementLevel" "sms_serviceRequiredResources_requirementLevel" NOT NULL DEFAULT 'required',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_serviceRequiredResources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_services" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "organizationId" BIGINT NOT NULL,
    "categoryId" BIGINT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "basePriceAmount" DECIMAL(10,2) NOT NULL,
    "baseDurationMinutes" SMALLINT NOT NULL,
    "isTaxInclusive" BOOLEAN NOT NULL DEFAULT false,
    "taxRateOverridePercentage" DECIMAL(5,2),
    "defaultDiscountPercentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "onlineBookingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "status" "sms_services_status" NOT NULL DEFAULT 'active',
    "createdById" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "sms_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_shiftTemplates" (
    "id" BIGSERIAL NOT NULL,
    "organizationId" BIGINT NOT NULL,
    "branchId" BIGINT,
    "name" VARCHAR(80) NOT NULL,
    "startTime" TIME NOT NULL,
    "endTime" TIME NOT NULL,
    "breakStartTime" TIME,
    "breakEndTime" TIME,
    "colorTag" VARCHAR(20) NOT NULL DEFAULT 'default',
    "status" "sms_shiftTemplates_status" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_shiftTemplates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_staff" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "organizationId" BIGINT NOT NULL,
    "userId" BIGINT,
    "employeeCode" VARCHAR(30) NOT NULL,
    "fullName" VARCHAR(150) NOT NULL,
    "dateOfBirth" DATE,
    "gender" "sms_staff_gender",
    "profilePhotoUrl" VARCHAR(500),
    "homeBranchId" BIGINT NOT NULL,
    "employmentStatus" "sms_staff_employmentStatus" NOT NULL DEFAULT 'active',
    "createdById" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "sms_staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_staffAttendance" (
    "id" BIGSERIAL NOT NULL,
    "staffId" BIGINT NOT NULL,
    "branchId" BIGINT NOT NULL,
    "attendanceDate" DATE NOT NULL,
    "checkInAt" TIMESTAMP(3),
    "checkInMethod" "sms_checkinMethod",
    "checkOutAt" TIMESTAMP(3),
    "checkOutMethod" "sms_checkinMethod",
    "status" "sms_staffAttendance_status" NOT NULL DEFAULT 'absent',
    "workedMinutes" INTEGER,
    "overtimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_staffAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_staffAttendanceCorrections" (
    "id" BIGSERIAL NOT NULL,
    "attendanceId" BIGINT,
    "staffId" BIGINT NOT NULL,
    "correctionDate" DATE NOT NULL,
    "requestedCheckInAt" TIMESTAMP(3),
    "requestedCheckOutAt" TIMESTAMP(3),
    "reason" VARCHAR(255) NOT NULL,
    "supportingDocumentUrl" VARCHAR(500),
    "status" "sms_staffAttendanceCorrections_status" NOT NULL DEFAULT 'pending',
    "reviewedById" BIGINT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" VARCHAR(255),
    "createdById" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_staffAttendanceCorrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_staffAttendanceMonthlySummary" (
    "id" BIGSERIAL NOT NULL,
    "staffId" BIGINT NOT NULL,
    "branchId" BIGINT NOT NULL,
    "summaryYear" SMALLINT NOT NULL,
    "summaryMonth" SMALLINT NOT NULL,
    "totalWorkingDays" SMALLINT NOT NULL DEFAULT 0,
    "totalPresentDays" SMALLINT NOT NULL DEFAULT 0,
    "totalAbsentDays" SMALLINT NOT NULL DEFAULT 0,
    "totalLateDays" SMALLINT NOT NULL DEFAULT 0,
    "totalHalfDays" SMALLINT NOT NULL DEFAULT 0,
    "totalLeaveDays" SMALLINT NOT NULL DEFAULT 0,
    "totalWorkedMinutes" INTEGER NOT NULL DEFAULT 0,
    "totalOvertimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_staffAttendanceMonthlySummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_staffAvailabilityPreferences" (
    "id" BIGSERIAL NOT NULL,
    "staffId" BIGINT NOT NULL,
    "dayOfWeek" SMALLINT,
    "startTime" TIME,
    "endTime" TIME,
    "preferenceType" "sms_staffAvailabilityPreferences_preferenceType" NOT NULL,
    "note" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_staffAvailabilityPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_staffBlockedTime" (
    "id" BIGSERIAL NOT NULL,
    "staffId" BIGINT NOT NULL,
    "branchId" BIGINT NOT NULL,
    "blockDate" DATE NOT NULL,
    "startTime" TIME NOT NULL,
    "endTime" TIME NOT NULL,
    "reasonCategory" "sms_staffBlockedTime_reasonCategory" NOT NULL DEFAULT 'other',
    "note" VARCHAR(255),
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceEndDate" DATE,
    "createdById" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_staffBlockedTime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_staffBranchAssignments" (
    "id" BIGSERIAL NOT NULL,
    "staffId" BIGINT NOT NULL,
    "branchId" BIGINT NOT NULL,
    "assignmentType" "sms_staffBranchAssignments_assignmentType" NOT NULL DEFAULT 'secondary',
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdById" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_staffBranchAssignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_staffCommissionRates" (
    "id" BIGSERIAL NOT NULL,
    "staffId" BIGINT NOT NULL,
    "serviceId" BIGINT,
    "isCommissionEligible" BOOLEAN NOT NULL DEFAULT true,
    "commissionType" "sms_commission_type" NOT NULL DEFAULT 'percentage',
    "commissionValue" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdById" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_staffCommissionRates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_staffContacts" (
    "id" BIGSERIAL NOT NULL,
    "staffId" BIGINT NOT NULL,
    "personalPhone" VARCHAR(20),
    "personalEmail" VARCHAR(150),
    "addressLine1" VARCHAR(200),
    "addressLine2" VARCHAR(200),
    "city" VARCHAR(80),
    "state" VARCHAR(80),
    "postalCode" VARCHAR(20),
    "countryCode" CHAR(2),
    "bloodGroup" VARCHAR(5),
    "maritalStatus" "sms_staffContacts_maritalStatus",
    "nationalIdNumberEncrypted" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_staffContacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_staffDesignations" (
    "id" BIGSERIAL NOT NULL,
    "staffId" BIGINT NOT NULL,
    "designationType" "sms_staffDesignations_designationType" NOT NULL,
    "customLabel" VARCHAR(100),
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "yearsOfExperience" SMALLINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_staffDesignations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_staffDocuments" (
    "id" BIGSERIAL NOT NULL,
    "staffId" BIGINT NOT NULL,
    "category" "sms_staffDocuments_category" NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "fileUrl" VARCHAR(500) NOT NULL,
    "fileSizeBytes" INTEGER,
    "status" "sms_staffDocuments_status" NOT NULL DEFAULT 'active',
    "supersedesDocumentId" BIGINT,
    "uploadedById" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_staffDocuments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_staffEmergencyContacts" (
    "id" BIGSERIAL NOT NULL,
    "staffId" BIGINT NOT NULL,
    "contactName" VARCHAR(120) NOT NULL,
    "relationship" VARCHAR(60),
    "phoneNumber" VARCHAR(20) NOT NULL,
    "priority" "sms_branchManagerAssignments_assignmentType" NOT NULL DEFAULT 'primary',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_staffEmergencyContacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_staffEmploymentHistory" (
    "id" BIGSERIAL NOT NULL,
    "staffId" BIGINT NOT NULL,
    "designation" VARCHAR(100) NOT NULL,
    "department" VARCHAR(100) NOT NULL,
    "employmentType" "sms_staffEmploymentHistory_employmentType" NOT NULL,
    "joiningDate" DATE NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "confirmationDate" DATE,
    "changeReason" "sms_staffEmploymentHistory_changeReason" NOT NULL DEFAULT 'initial_hire',
    "recordedById" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_staffEmploymentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_staffLeaveBalances" (
    "id" BIGSERIAL NOT NULL,
    "staffId" BIGINT NOT NULL,
    "leaveTypeId" BIGINT NOT NULL,
    "balanceYear" SMALLINT NOT NULL,
    "openingBalanceDays" DECIMAL(5,1) NOT NULL DEFAULT 0,
    "carriedForwardDays" DECIMAL(5,1) NOT NULL DEFAULT 0,
    "accruedDays" DECIMAL(5,1) NOT NULL DEFAULT 0,
    "usedDays" DECIMAL(5,1) NOT NULL DEFAULT 0,
    "manualAdjustmentDays" DECIMAL(5,1) NOT NULL DEFAULT 0,
    "closingBalanceDays" DECIMAL(5,1) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_staffLeaveBalances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_staffLeaveRequests" (
    "id" BIGSERIAL NOT NULL,
    "staffId" BIGINT NOT NULL,
    "leaveTypeId" BIGINT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "isHalfDay" BOOLEAN NOT NULL DEFAULT false,
    "halfDayPeriod" "sms_staffLeaveRequests_halfDayPeriod",
    "totalDays" DECIMAL(5,1) NOT NULL,
    "reason" VARCHAR(255) NOT NULL,
    "supportingDocumentUrl" VARCHAR(500),
    "status" "sms_staffLeaveRequests_status" NOT NULL DEFAULT 'pending',
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_staffLeaveRequests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_staffPermissionOverrides" (
    "id" BIGSERIAL NOT NULL,
    "staffId" BIGINT NOT NULL,
    "permissionId" BIGINT NOT NULL,
    "overrideType" "sms_staffPermissionOverrides_overrideType" NOT NULL,
    "branchId" BIGINT,
    "reason" VARCHAR(255) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "grantedById" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_staffPermissionOverrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_staffQualifications" (
    "id" BIGSERIAL NOT NULL,
    "staffId" BIGINT NOT NULL,
    "recordType" "sms_staffQualifications_recordType" NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "issuingInstitution" VARCHAR(150),
    "certificateNumber" VARCHAR(80),
    "issueDate" DATE,
    "expiryDate" DATE,
    "documentUrl" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_staffQualifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_staffScheduleOverrides" (
    "id" BIGSERIAL NOT NULL,
    "staffId" BIGINT NOT NULL,
    "overrideDate" DATE NOT NULL,
    "overrideType" "sms_staffScheduleOverrides_overrideType" NOT NULL,
    "startTime" TIME,
    "endTime" TIME,
    "reason" VARCHAR(255) NOT NULL,
    "linkedSwapId" BIGINT,
    "approvalStatus" "sms_approvalStatus" NOT NULL DEFAULT 'not_required',
    "approvedById" BIGINT,
    "createdById" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_staffScheduleOverrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_staffServiceBranchOverrides" (
    "id" BIGSERIAL NOT NULL,
    "staffServiceId" BIGINT NOT NULL,
    "branchId" BIGINT NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT false,
    "reason" VARCHAR(255),
    "createdById" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_staffServiceBranchOverrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_staffServices" (
    "id" BIGSERIAL NOT NULL,
    "staffId" BIGINT NOT NULL,
    "serviceId" BIGINT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "durationOverrideMinutes" SMALLINT,
    "assignedById" BIGINT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_staffServices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_staffSkillRatings" (
    "id" BIGSERIAL NOT NULL,
    "staffId" BIGINT NOT NULL,
    "skillName" VARCHAR(100) NOT NULL,
    "proficiencyLevel" "sms_staffSkillRatings_proficiencyLevel" NOT NULL DEFAULT 'beginner',
    "verificationStatus" "sms_staffSkillRatings_verificationStatus" NOT NULL DEFAULT 'self_declared',
    "verifiedById" BIGINT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_staffSkillRatings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_staffWeeklySchedules" (
    "id" BIGSERIAL NOT NULL,
    "staffId" BIGINT NOT NULL,
    "dayOfWeek" SMALLINT NOT NULL,
    "isWorking" BOOLEAN NOT NULL DEFAULT true,
    "shiftTemplateId" BIGINT,
    "customStartTime" TIME,
    "customEndTime" TIME,
    "customBreakStartTime" TIME,
    "customBreakEndTime" TIME,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdById" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_staffWeeklySchedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_userBranchAssignments" (
    "id" BIGSERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "branchId" BIGINT NOT NULL,
    "isHomeBranch" BOOLEAN NOT NULL DEFAULT false,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "assignedById" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_userBranchAssignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_userPasswordResets" (
    "id" BIGSERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "resetToken" VARCHAR(100) NOT NULL,
    "deliveryMethod" "sms_userPasswordResets_deliveryMethod" NOT NULL,
    "requestedIp" VARCHAR(45),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "initiatedBy" "sms_userPasswordResets_initiatedBy" NOT NULL DEFAULT 'self',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_userPasswordResets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_userRoles" (
    "id" BIGSERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "roleId" BIGINT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "assignedById" BIGINT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "sms_userRoles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_userSessions" (
    "id" BIGSERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "sessionTokenHash" VARCHAR(255) NOT NULL,
    "deviceLabel" VARCHAR(150),
    "ipAddress" VARCHAR(45),
    "lastActiveAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_userSessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_userStatusLogs" (
    "id" BIGSERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "fromStatus" "sms_userStatusLogs_status",
    "toStatus" "sms_userStatusLogs_status" NOT NULL,
    "reason" VARCHAR(255),
    "changedById" BIGINT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_userStatusLogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_userTwoFactorSettings" (
    "id" BIGSERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "method" "sms_userTwoFactorSettings_method" NOT NULL DEFAULT 'totp',
    "totpSecretEncrypted" VARCHAR(255),
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "enabledAt" TIMESTAMP(3),
    "backupCodesEncrypted" TEXT,
    "gracePeriodEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_userTwoFactorSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_users" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "organizationId" BIGINT NOT NULL,
    "displayName" VARCHAR(120) NOT NULL,
    "email" VARCHAR(150),
    "phoneCountryCode" VARCHAR(5),
    "phoneNumber" VARCHAR(20),
    "passwordHash" VARCHAR(255),
    "status" "sms_userStatusLogs_status" NOT NULL DEFAULT 'pending_invite',
    "profilePhotoUrl" VARCHAR(500),
    "inviteToken" VARCHAR(100),
    "inviteExpiresAt" TIMESTAMP(3),
    "inviteAcceptedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "lastLoginIp" VARCHAR(45),
    "createdById" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "sms_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sms_addonBranchAvailability_addonId_branchId_key" ON "sms_addonBranchAvailability"("addonId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "sms_addonCommissionDefaults_addonId_key" ON "sms_addonCommissionDefaults"("addonId");

-- CreateIndex
CREATE INDEX "sms_addonServiceMappings_serviceId_isRecommended_idx" ON "sms_addonServiceMappings"("serviceId", "isRecommended");

-- CreateIndex
CREATE UNIQUE INDEX "sms_addonServiceMappings_addonId_serviceId_key" ON "sms_addonServiceMappings"("addonId", "serviceId");

-- CreateIndex
CREATE INDEX "sms_addons_addonType_status_idx" ON "sms_addons"("addonType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sms_addons_organizationId_slug_key" ON "sms_addons"("organizationId", "slug");

-- CreateIndex
CREATE INDEX "sms_attendancePeriodApprovals_branchId_status_idx" ON "sms_attendancePeriodApprovals"("branchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sms_attendancePeriodApprovals_staffId_periodStart_periodEnd_key" ON "sms_attendancePeriodApprovals"("staffId", "periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "sms_attendancePolicies_organizationId_branchId_key" ON "sms_attendancePolicies"("organizationId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "sms_branchAddresses_branchId_key" ON "sms_branchAddresses"("branchId");

-- CreateIndex
CREATE INDEX "sms_branchAddresses_latitude_longitude_idx" ON "sms_branchAddresses"("latitude", "longitude");

-- CreateIndex
CREATE UNIQUE INDEX "sms_branchContacts_branchId_key" ON "sms_branchContacts"("branchId");

-- CreateIndex
CREATE INDEX "sms_branchManagerAssignments_branchId_assignmentType_endDat_idx" ON "sms_branchManagerAssignments"("branchId", "assignmentType", "endDate");

-- CreateIndex
CREATE INDEX "sms_branchManagerAssignments_staffId_idx" ON "sms_branchManagerAssignments"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "sms_branchScheduleOverrides_branchId_overrideDate_key" ON "sms_branchScheduleOverrides"("branchId", "overrideDate");

-- CreateIndex
CREATE UNIQUE INDEX "sms_branchSettings_branchId_key" ON "sms_branchSettings"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "sms_branches_uuid_key" ON "sms_branches"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "sms_branches_code_key" ON "sms_branches"("code");

-- CreateIndex
CREATE UNIQUE INDEX "sms_businessHours_organizationId_branchId_dayOfWeek_key" ON "sms_businessHours"("organizationId", "branchId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "sms_customerAddresses_customerId_isPrimary_idx" ON "sms_customerAddresses"("customerId", "isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "sms_customerMergeLogs_mergedCustomerId_key" ON "sms_customerMergeLogs"("mergedCustomerId");

-- CreateIndex
CREATE INDEX "sms_customerMergeLogs_survivingCustomerId_idx" ON "sms_customerMergeLogs"("survivingCustomerId");

-- CreateIndex
CREATE INDEX "sms_customerNotes_customerId_createdAt_idx" ON "sms_customerNotes"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "sms_customerPackagePurchases_customerId_status_idx" ON "sms_customerPackagePurchases"("customerId", "status");

-- CreateIndex
CREATE INDEX "sms_customerPackagePurchases_expiryDate_idx" ON "sms_customerPackagePurchases"("expiryDate");

-- CreateIndex
CREATE INDEX "sms_customerPackageUsageLogs_packagePurchaseId_serviceId_idx" ON "sms_customerPackageUsageLogs"("packagePurchaseId", "serviceId");

-- CreateIndex
CREATE INDEX "sms_customerPackageUsageLogs_appointmentId_idx" ON "sms_customerPackageUsageLogs"("appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "sms_customerPreferences_customerId_key" ON "sms_customerPreferences"("customerId");

-- CreateIndex
CREATE INDEX "sms_customerTags_organizationId_tagName_idx" ON "sms_customerTags"("organizationId", "tagName");

-- CreateIndex
CREATE UNIQUE INDEX "sms_customerTags_customerId_tagName_key" ON "sms_customerTags"("customerId", "tagName");

-- CreateIndex
CREATE UNIQUE INDEX "sms_customers_uuid_key" ON "sms_customers"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "sms_customers_customerCode_key" ON "sms_customers"("customerCode");

-- CreateIndex
CREATE INDEX "sms_customers_organizationId_phoneNumber_idx" ON "sms_customers"("organizationId", "phoneNumber");

-- CreateIndex
CREATE INDEX "sms_customers_organizationId_email_idx" ON "sms_customers"("organizationId", "email");

-- CreateIndex
CREATE INDEX "sms_holidays_organizationId_branchId_holidayDate_idx" ON "sms_holidays"("organizationId", "branchId", "holidayDate");

-- CreateIndex
CREATE INDEX "sms_leaveApprovalLogs_leaveRequestId_actionAt_idx" ON "sms_leaveApprovalLogs"("leaveRequestId", "actionAt");

-- CreateIndex
CREATE INDEX "sms_leaveBlackoutPeriods_organizationId_branchId_startDate__idx" ON "sms_leaveBlackoutPeriods"("organizationId", "branchId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "sms_leaveTypes_status_idx" ON "sms_leaveTypes"("status");

-- CreateIndex
CREATE UNIQUE INDEX "sms_leaveTypes_organizationId_code_key" ON "sms_leaveTypes"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "sms_organizationAddresses_organizationId_addressType_key" ON "sms_organizationAddresses"("organizationId", "addressType");

-- CreateIndex
CREATE INDEX "sms_organizationContacts_organizationId_contactType_idx" ON "sms_organizationContacts"("organizationId", "contactType");

-- CreateIndex
CREATE UNIQUE INDEX "sms_organizationSettings_organizationId_key" ON "sms_organizationSettings"("organizationId");

-- CreateIndex
CREATE INDEX "sms_organizationTaxProfiles_organizationId_idx" ON "sms_organizationTaxProfiles"("organizationId");

-- CreateIndex
CREATE INDEX "sms_organizationTaxProfiles_verificationStatus_idx" ON "sms_organizationTaxProfiles"("verificationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "sms_organizations_uuid_key" ON "sms_organizations"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "sms_organizations_slug_key" ON "sms_organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "sms_permissions_permissionKey_key" ON "sms_permissions"("permissionKey");

-- CreateIndex
CREATE INDEX "sms_permissions_moduleCode_action_idx" ON "sms_permissions"("moduleCode", "action");

-- CreateIndex
CREATE INDEX "sms_resourceBlockedTime_resourceId_blockDate_idx" ON "sms_resourceBlockedTime"("resourceId", "blockDate");

-- CreateIndex
CREATE INDEX "sms_resourceBlockedTime_branchId_blockDate_idx" ON "sms_resourceBlockedTime"("branchId", "blockDate");

-- CreateIndex
CREATE INDEX "sms_resourceMaintenanceLogs_resourceId_status_idx" ON "sms_resourceMaintenanceLogs"("resourceId", "status");

-- CreateIndex
CREATE INDEX "sms_resourceTypes_category_status_idx" ON "sms_resourceTypes"("category", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sms_resourceTypes_organizationId_name_key" ON "sms_resourceTypes"("organizationId", "name");

-- CreateIndex
CREATE INDEX "sms_resources_branchId_resourceTypeId_status_idx" ON "sms_resources"("branchId", "resourceTypeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sms_resources_branchId_label_key" ON "sms_resources"("branchId", "label");

-- CreateIndex
CREATE INDEX "sms_roleBranchRestrictions_branchId_idx" ON "sms_roleBranchRestrictions"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "sms_roleBranchRestrictions_roleId_moduleCode_branchId_key" ON "sms_roleBranchRestrictions"("roleId", "moduleCode", "branchId");

-- CreateIndex
CREATE INDEX "sms_rolePermissions_permissionId_idx" ON "sms_rolePermissions"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "sms_rolePermissions_roleId_permissionId_key" ON "sms_rolePermissions"("roleId", "permissionId");

-- CreateIndex
CREATE INDEX "sms_roles_roleType_status_idx" ON "sms_roles"("roleType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sms_roles_organizationId_slug_key" ON "sms_roles"("organizationId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "sms_serviceBranchAvailability_serviceId_branchId_key" ON "sms_serviceBranchAvailability"("serviceId", "branchId");

-- CreateIndex
CREATE INDEX "sms_serviceBranchPricing_branchId_effectiveFrom_idx" ON "sms_serviceBranchPricing"("branchId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "sms_serviceBranchPricing_serviceId_branchId_effectiveFrom_key" ON "sms_serviceBranchPricing"("serviceId", "branchId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "sms_serviceCategories_parentCategoryId_displayOrder_idx" ON "sms_serviceCategories"("parentCategoryId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "sms_serviceCategories_organizationId_slug_key" ON "sms_serviceCategories"("organizationId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "sms_serviceCategoryBranchSettings_categoryId_branchId_key" ON "sms_serviceCategoryBranchSettings"("categoryId", "branchId");

-- CreateIndex
CREATE INDEX "sms_serviceCategoryMedia_categoryId_mediaType_idx" ON "sms_serviceCategoryMedia"("categoryId", "mediaType");

-- CreateIndex
CREATE UNIQUE INDEX "sms_serviceCommissionDefaults_serviceId_key" ON "sms_serviceCommissionDefaults"("serviceId");

-- CreateIndex
CREATE INDEX "sms_serviceMedia_serviceId_mediaType_displayOrder_idx" ON "sms_serviceMedia"("serviceId", "mediaType", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "sms_servicePackageBranchAvailability_packageId_branchId_key" ON "sms_servicePackageBranchAvailability"("packageId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "sms_servicePackageItems_packageId_serviceId_key" ON "sms_servicePackageItems"("packageId", "serviceId");

-- CreateIndex
CREATE INDEX "sms_servicePackages_status_idx" ON "sms_servicePackages"("status");

-- CreateIndex
CREATE UNIQUE INDEX "sms_servicePackages_organizationId_slug_key" ON "sms_servicePackages"("organizationId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "sms_serviceRequiredProducts_serviceId_productId_key" ON "sms_serviceRequiredProducts"("serviceId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "sms_serviceRequiredResources_serviceId_resourceTypeId_key" ON "sms_serviceRequiredResources"("serviceId", "resourceTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "sms_services_uuid_key" ON "sms_services"("uuid");

-- CreateIndex
CREATE INDEX "sms_services_categoryId_status_idx" ON "sms_services"("categoryId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sms_services_organizationId_slug_key" ON "sms_services"("organizationId", "slug");

-- CreateIndex
CREATE INDEX "sms_shiftTemplates_status_idx" ON "sms_shiftTemplates"("status");

-- CreateIndex
CREATE UNIQUE INDEX "sms_shiftTemplates_organizationId_branchId_name_key" ON "sms_shiftTemplates"("organizationId", "branchId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "sms_staff_uuid_key" ON "sms_staff"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "sms_staff_userId_key" ON "sms_staff"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "sms_staff_employeeCode_key" ON "sms_staff"("employeeCode");

-- CreateIndex
CREATE INDEX "sms_staff_homeBranchId_employmentStatus_idx" ON "sms_staff"("homeBranchId", "employmentStatus");

-- CreateIndex
CREATE INDEX "sms_staffAttendance_branchId_attendanceDate_status_idx" ON "sms_staffAttendance"("branchId", "attendanceDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sms_staffAttendance_staffId_attendanceDate_key" ON "sms_staffAttendance"("staffId", "attendanceDate");

-- CreateIndex
CREATE INDEX "sms_staffAttendanceCorrections_staffId_correctionDate_idx" ON "sms_staffAttendanceCorrections"("staffId", "correctionDate");

-- CreateIndex
CREATE INDEX "sms_staffAttendanceCorrections_status_idx" ON "sms_staffAttendanceCorrections"("status");

-- CreateIndex
CREATE INDEX "sms_staffAttendanceMonthlySummary_branchId_summaryYear_summ_idx" ON "sms_staffAttendanceMonthlySummary"("branchId", "summaryYear", "summaryMonth");

-- CreateIndex
CREATE UNIQUE INDEX "sms_staffAttendanceMonthlySummary_staffId_summaryYear_summa_key" ON "sms_staffAttendanceMonthlySummary"("staffId", "summaryYear", "summaryMonth");

-- CreateIndex
CREATE INDEX "sms_staffAvailabilityPreferences_staffId_dayOfWeek_idx" ON "sms_staffAvailabilityPreferences"("staffId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "sms_staffBlockedTime_staffId_blockDate_idx" ON "sms_staffBlockedTime"("staffId", "blockDate");

-- CreateIndex
CREATE INDEX "sms_staffBlockedTime_branchId_blockDate_idx" ON "sms_staffBlockedTime"("branchId", "blockDate");

-- CreateIndex
CREATE INDEX "sms_staffBranchAssignments_branchId_assignmentType_idx" ON "sms_staffBranchAssignments"("branchId", "assignmentType");

-- CreateIndex
CREATE UNIQUE INDEX "sms_staffBranchAssignments_staffId_branchId_effectiveFrom_key" ON "sms_staffBranchAssignments"("staffId", "branchId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "sms_staffCommissionRates_staffId_serviceId_effectiveFrom_idx" ON "sms_staffCommissionRates"("staffId", "serviceId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "sms_staffContacts_staffId_key" ON "sms_staffContacts"("staffId");

-- CreateIndex
CREATE INDEX "sms_staffDesignations_staffId_isPrimary_idx" ON "sms_staffDesignations"("staffId", "isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "sms_staffDesignations_staffId_designationType_customLabel_key" ON "sms_staffDesignations"("staffId", "designationType", "customLabel");

-- CreateIndex
CREATE INDEX "sms_staffDocuments_staffId_category_status_idx" ON "sms_staffDocuments"("staffId", "category", "status");

-- CreateIndex
CREATE INDEX "sms_staffEmergencyContacts_staffId_priority_idx" ON "sms_staffEmergencyContacts"("staffId", "priority");

-- CreateIndex
CREATE INDEX "sms_staffEmploymentHistory_staffId_effectiveFrom_idx" ON "sms_staffEmploymentHistory"("staffId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "sms_staffLeaveBalances_staffId_leaveTypeId_balanceYear_key" ON "sms_staffLeaveBalances"("staffId", "leaveTypeId", "balanceYear");

-- CreateIndex
CREATE INDEX "sms_staffLeaveRequests_staffId_status_idx" ON "sms_staffLeaveRequests"("staffId", "status");

-- CreateIndex
CREATE INDEX "sms_staffLeaveRequests_startDate_endDate_idx" ON "sms_staffLeaveRequests"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "sms_staffPermissionOverrides_expiresAt_idx" ON "sms_staffPermissionOverrides"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "sms_staffPermissionOverrides_staffId_permissionId_branchId_key" ON "sms_staffPermissionOverrides"("staffId", "permissionId", "branchId");

-- CreateIndex
CREATE INDEX "sms_staffQualifications_staffId_recordType_idx" ON "sms_staffQualifications"("staffId", "recordType");

-- CreateIndex
CREATE INDEX "sms_staffQualifications_expiryDate_idx" ON "sms_staffQualifications"("expiryDate");

-- CreateIndex
CREATE INDEX "sms_staffScheduleOverrides_approvalStatus_idx" ON "sms_staffScheduleOverrides"("approvalStatus");

-- CreateIndex
CREATE UNIQUE INDEX "sms_staffScheduleOverrides_staffId_overrideDate_key" ON "sms_staffScheduleOverrides"("staffId", "overrideDate");

-- CreateIndex
CREATE UNIQUE INDEX "sms_staffServiceBranchOverrides_staffServiceId_branchId_key" ON "sms_staffServiceBranchOverrides"("staffServiceId", "branchId");

-- CreateIndex
CREATE INDEX "sms_staffServices_serviceId_isActive_idx" ON "sms_staffServices"("serviceId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "sms_staffServices_staffId_serviceId_key" ON "sms_staffServices"("staffId", "serviceId");

-- CreateIndex
CREATE INDEX "sms_staffSkillRatings_skillName_proficiencyLevel_idx" ON "sms_staffSkillRatings"("skillName", "proficiencyLevel");

-- CreateIndex
CREATE UNIQUE INDEX "sms_staffSkillRatings_staffId_skillName_key" ON "sms_staffSkillRatings"("staffId", "skillName");

-- CreateIndex
CREATE INDEX "sms_staffWeeklySchedules_staffId_isWorking_idx" ON "sms_staffWeeklySchedules"("staffId", "isWorking");

-- CreateIndex
CREATE UNIQUE INDEX "sms_staffWeeklySchedules_staffId_dayOfWeek_effectiveFrom_key" ON "sms_staffWeeklySchedules"("staffId", "dayOfWeek", "effectiveFrom");

-- CreateIndex
CREATE INDEX "sms_userBranchAssignments_userId_isHomeBranch_idx" ON "sms_userBranchAssignments"("userId", "isHomeBranch");

-- CreateIndex
CREATE UNIQUE INDEX "sms_userBranchAssignments_userId_branchId_effectiveFrom_key" ON "sms_userBranchAssignments"("userId", "branchId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "sms_userPasswordResets_resetToken_key" ON "sms_userPasswordResets"("resetToken");

-- CreateIndex
CREATE INDEX "sms_userPasswordResets_userId_expiresAt_idx" ON "sms_userPasswordResets"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "sms_userRoles_userId_isPrimary_idx" ON "sms_userRoles"("userId", "isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "sms_userRoles_userId_roleId_key" ON "sms_userRoles"("userId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "sms_userSessions_sessionTokenHash_key" ON "sms_userSessions"("sessionTokenHash");

-- CreateIndex
CREATE INDEX "sms_userSessions_userId_revokedAt_idx" ON "sms_userSessions"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "sms_userStatusLogs_userId_changedAt_idx" ON "sms_userStatusLogs"("userId", "changedAt");

-- CreateIndex
CREATE UNIQUE INDEX "sms_userTwoFactorSettings_userId_key" ON "sms_userTwoFactorSettings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "sms_users_uuid_key" ON "sms_users"("uuid");

-- CreateIndex
CREATE INDEX "sms_users_organizationId_email_idx" ON "sms_users"("organizationId", "email");

-- CreateIndex
CREATE INDEX "sms_users_organizationId_phoneNumber_idx" ON "sms_users"("organizationId", "phoneNumber");

-- AddForeignKey
ALTER TABLE "sms_addonBranchAvailability" ADD CONSTRAINT "sms_addonBranchAvailability_addonId_fkey" FOREIGN KEY ("addonId") REFERENCES "sms_addons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_addonBranchAvailability" ADD CONSTRAINT "sms_addonBranchAvailability_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "sms_branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_addonCommissionDefaults" ADD CONSTRAINT "sms_addonCommissionDefaults_addonId_fkey" FOREIGN KEY ("addonId") REFERENCES "sms_addons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_addonServiceMappings" ADD CONSTRAINT "sms_addonServiceMappings_addonId_fkey" FOREIGN KEY ("addonId") REFERENCES "sms_addons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_addonServiceMappings" ADD CONSTRAINT "sms_addonServiceMappings_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "sms_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_addons" ADD CONSTRAINT "sms_addons_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "sms_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_addons" ADD CONSTRAINT "sms_addons_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "sms_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_attendancePeriodApprovals" ADD CONSTRAINT "sms_attendancePeriodApprovals_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "sms_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_attendancePeriodApprovals" ADD CONSTRAINT "sms_attendancePeriodApprovals_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "sms_branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_attendancePeriodApprovals" ADD CONSTRAINT "sms_attendancePeriodApprovals_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "sms_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_attendancePeriodApprovals" ADD CONSTRAINT "sms_attendancePeriodApprovals_reopenedById_fkey" FOREIGN KEY ("reopenedById") REFERENCES "sms_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_attendancePolicies" ADD CONSTRAINT "sms_attendancePolicies_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "sms_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_attendancePolicies" ADD CONSTRAINT "sms_attendancePolicies_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "sms_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_branchAddresses" ADD CONSTRAINT "sms_branchAddresses_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "sms_branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_branchContacts" ADD CONSTRAINT "sms_branchContacts_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "sms_branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_branchManagerAssignments" ADD CONSTRAINT "sms_branchManagerAssignments_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "sms_branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_branchManagerAssignments" ADD CONSTRAINT "sms_branchManagerAssignments_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "sms_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_branchScheduleOverrides" ADD CONSTRAINT "sms_branchScheduleOverrides_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "sms_branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_branchScheduleOverrides" ADD CONSTRAINT "sms_branchScheduleOverrides_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "sms_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_branchSettings" ADD CONSTRAINT "sms_branchSettings_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "sms_branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_branches" ADD CONSTRAINT "sms_branches_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "sms_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_branches" ADD CONSTRAINT "sms_branches_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "sms_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_businessHours" ADD CONSTRAINT "sms_businessHours_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "sms_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_businessHours" ADD CONSTRAINT "sms_businessHours_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "sms_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_customerAddresses" ADD CONSTRAINT "sms_customerAddresses_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "sms_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_customerMergeLogs" ADD CONSTRAINT "sms_customerMergeLogs_survivingCustomerId_fkey" FOREIGN KEY ("survivingCustomerId") REFERENCES "sms_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_customerMergeLogs" ADD CONSTRAINT "sms_customerMergeLogs_mergedCustomerId_fkey" FOREIGN KEY ("mergedCustomerId") REFERENCES "sms_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_customerMergeLogs" ADD CONSTRAINT "sms_customerMergeLogs_mergedById_fkey" FOREIGN KEY ("mergedById") REFERENCES "sms_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_customerNotes" ADD CONSTRAINT "sms_customerNotes_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "sms_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_customerNotes" ADD CONSTRAINT "sms_customerNotes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "sms_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_customerPackagePurchases" ADD CONSTRAINT "sms_customerPackagePurchases_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "sms_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_customerPackagePurchases" ADD CONSTRAINT "sms_customerPackagePurchases_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "sms_servicePackages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_customerPackagePurchases" ADD CONSTRAINT "sms_customerPackagePurchases_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "sms_branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_customerPackageUsageLogs" ADD CONSTRAINT "sms_customerPackageUsageLogs_packagePurchaseId_fkey" FOREIGN KEY ("packagePurchaseId") REFERENCES "sms_customerPackagePurchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_customerPackageUsageLogs" ADD CONSTRAINT "sms_customerPackageUsageLogs_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "sms_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_customerPackageUsageLogs" ADD CONSTRAINT "sms_customerPackageUsageLogs_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "sms_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_customerPreferences" ADD CONSTRAINT "sms_customerPreferences_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "sms_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_customerPreferences" ADD CONSTRAINT "sms_customerPreferences_preferredBranchId_fkey" FOREIGN KEY ("preferredBranchId") REFERENCES "sms_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_customerPreferences" ADD CONSTRAINT "sms_customerPreferences_preferredStaffId_fkey" FOREIGN KEY ("preferredStaffId") REFERENCES "sms_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_customerTags" ADD CONSTRAINT "sms_customerTags_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "sms_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_customerTags" ADD CONSTRAINT "sms_customerTags_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "sms_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_customerTags" ADD CONSTRAINT "sms_customerTags_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "sms_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_customers" ADD CONSTRAINT "sms_customers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "sms_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_customers" ADD CONSTRAINT "sms_customers_registeredBranchId_fkey" FOREIGN KEY ("registeredBranchId") REFERENCES "sms_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_customers" ADD CONSTRAINT "sms_customers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "sms_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_holidays" ADD CONSTRAINT "sms_holidays_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "sms_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_holidays" ADD CONSTRAINT "sms_holidays_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "sms_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_holidays" ADD CONSTRAINT "sms_holidays_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "sms_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_leaveApprovalLogs" ADD CONSTRAINT "sms_leaveApprovalLogs_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId") REFERENCES "sms_staffLeaveRequests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_leaveApprovalLogs" ADD CONSTRAINT "sms_leaveApprovalLogs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "sms_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_leaveBlackoutPeriods" ADD CONSTRAINT "sms_leaveBlackoutPeriods_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "sms_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_leaveBlackoutPeriods" ADD CONSTRAINT "sms_leaveBlackoutPeriods_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "sms_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_leaveBlackoutPeriods" ADD CONSTRAINT "sms_leaveBlackoutPeriods_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "sms_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_leaveTypes" ADD CONSTRAINT "sms_leaveTypes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "sms_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_organizationAddresses" ADD CONSTRAINT "sms_organizationAddresses_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "sms_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_organizationContacts" ADD CONSTRAINT "sms_organizationContacts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "sms_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_organizationSettings" ADD CONSTRAINT "sms_organizationSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "sms_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_organizationTaxProfiles" ADD CONSTRAINT "sms_organizationTaxProfiles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "sms_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_organizations" ADD CONSTRAINT "sms_organizations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "sms_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_resourceBlockedTime" ADD CONSTRAINT "sms_resourceBlockedTime_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "sms_resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_resourceBlockedTime" ADD CONSTRAINT "sms_resourceBlockedTime_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "sms_branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_resourceBlockedTime" ADD CONSTRAINT "sms_resourceBlockedTime_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "sms_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_resourceMaintenanceLogs" ADD CONSTRAINT "sms_resourceMaintenanceLogs_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "sms_resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_resourceMaintenanceLogs" ADD CONSTRAINT "sms_resourceMaintenanceLogs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "sms_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_resourceTypes" ADD CONSTRAINT "sms_resourceTypes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "sms_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_resources" ADD CONSTRAINT "sms_resources_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "sms_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_resources" ADD CONSTRAINT "sms_resources_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "sms_branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_resources" ADD CONSTRAINT "sms_resources_resourceTypeId_fkey" FOREIGN KEY ("resourceTypeId") REFERENCES "sms_resourceTypes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_resources" ADD CONSTRAINT "sms_resources_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "sms_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_roleBranchRestrictions" ADD CONSTRAINT "sms_roleBranchRestrictions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "sms_roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_roleBranchRestrictions" ADD CONSTRAINT "sms_roleBranchRestrictions_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "sms_branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_rolePermissions" ADD CONSTRAINT "sms_rolePermissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "sms_roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_rolePermissions" ADD CONSTRAINT "sms_rolePermissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "sms_permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_rolePermissions" ADD CONSTRAINT "sms_rolePermissions_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "sms_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_roles" ADD CONSTRAINT "sms_roles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "sms_organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_roles" ADD CONSTRAINT "sms_roles_clonedFromRoleId_fkey" FOREIGN KEY ("clonedFromRoleId") REFERENCES "sms_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_roles" ADD CONSTRAINT "sms_roles_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "sms_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_serviceBranchAvailability" ADD CONSTRAINT "sms_serviceBranchAvailability_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "sms_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_serviceBranchAvailability" ADD CONSTRAINT "sms_serviceBranchAvailability_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "sms_branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_serviceBranchAvailability" ADD CONSTRAINT "sms_serviceBranchAvailability_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "sms_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_serviceBranchPricing" ADD CONSTRAINT "sms_serviceBranchPricing_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "sms_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_serviceBranchPricing" ADD CONSTRAINT "sms_serviceBranchPricing_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "sms_branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_serviceBranchPricing" ADD CONSTRAINT "sms_serviceBranchPricing_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "sms_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_serviceCategories" ADD CONSTRAINT "sms_serviceCategories_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "sms_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_serviceCategories" ADD CONSTRAINT "sms_serviceCategories_parentCategoryId_fkey" FOREIGN KEY ("parentCategoryId") REFERENCES "sms_serviceCategories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_serviceCategories" ADD CONSTRAINT "sms_serviceCategories_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "sms_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_serviceCategoryBranchSettings" ADD CONSTRAINT "sms_serviceCategoryBranchSettings_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "sms_serviceCategories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_serviceCategoryBranchSettings" ADD CONSTRAINT "sms_serviceCategoryBranchSettings_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "sms_branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_serviceCategoryMedia" ADD CONSTRAINT "sms_serviceCategoryMedia_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "sms_serviceCategories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_serviceCategoryMedia" ADD CONSTRAINT "sms_serviceCategoryMedia_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "sms_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_serviceCommissionDefaults" ADD CONSTRAINT "sms_serviceCommissionDefaults_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "sms_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_serviceMedia" ADD CONSTRAINT "sms_serviceMedia_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "sms_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_serviceMedia" ADD CONSTRAINT "sms_serviceMedia_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "sms_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_servicePackageBranchAvailability" ADD CONSTRAINT "sms_servicePackageBranchAvailability_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "sms_servicePackages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_servicePackageBranchAvailability" ADD CONSTRAINT "sms_servicePackageBranchAvailability_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "sms_branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_servicePackageItems" ADD CONSTRAINT "sms_servicePackageItems_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "sms_servicePackages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_servicePackageItems" ADD CONSTRAINT "sms_servicePackageItems_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "sms_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_servicePackages" ADD CONSTRAINT "sms_servicePackages_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "sms_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_servicePackages" ADD CONSTRAINT "sms_servicePackages_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "sms_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_serviceRequiredProducts" ADD CONSTRAINT "sms_serviceRequiredProducts_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "sms_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_serviceRequiredResources" ADD CONSTRAINT "sms_serviceRequiredResources_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "sms_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_serviceRequiredResources" ADD CONSTRAINT "sms_serviceRequiredResources_resourceTypeId_fkey" FOREIGN KEY ("resourceTypeId") REFERENCES "sms_resourceTypes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_services" ADD CONSTRAINT "sms_services_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "sms_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_services" ADD CONSTRAINT "sms_services_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "sms_serviceCategories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_services" ADD CONSTRAINT "sms_services_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "sms_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_shiftTemplates" ADD CONSTRAINT "sms_shiftTemplates_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "sms_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staff" ADD CONSTRAINT "sms_staff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "sms_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staff" ADD CONSTRAINT "sms_staff_homeBranchId_fkey" FOREIGN KEY ("homeBranchId") REFERENCES "sms_branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staff" ADD CONSTRAINT "sms_staff_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "sms_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffAttendance" ADD CONSTRAINT "sms_staffAttendance_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "sms_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffAttendance" ADD CONSTRAINT "sms_staffAttendance_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "sms_branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffAttendanceCorrections" ADD CONSTRAINT "sms_staffAttendanceCorrections_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "sms_staffAttendance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffAttendanceCorrections" ADD CONSTRAINT "sms_staffAttendanceCorrections_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "sms_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffAttendanceCorrections" ADD CONSTRAINT "sms_staffAttendanceCorrections_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "sms_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffAttendanceCorrections" ADD CONSTRAINT "sms_staffAttendanceCorrections_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "sms_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffAttendanceMonthlySummary" ADD CONSTRAINT "sms_staffAttendanceMonthlySummary_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "sms_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffAttendanceMonthlySummary" ADD CONSTRAINT "sms_staffAttendanceMonthlySummary_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "sms_branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffAvailabilityPreferences" ADD CONSTRAINT "sms_staffAvailabilityPreferences_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "sms_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffBlockedTime" ADD CONSTRAINT "sms_staffBlockedTime_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "sms_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffBlockedTime" ADD CONSTRAINT "sms_staffBlockedTime_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "sms_branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffBlockedTime" ADD CONSTRAINT "sms_staffBlockedTime_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "sms_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffBranchAssignments" ADD CONSTRAINT "sms_staffBranchAssignments_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "sms_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffBranchAssignments" ADD CONSTRAINT "sms_staffBranchAssignments_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "sms_branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffBranchAssignments" ADD CONSTRAINT "sms_staffBranchAssignments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "sms_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffCommissionRates" ADD CONSTRAINT "sms_staffCommissionRates_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "sms_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffCommissionRates" ADD CONSTRAINT "sms_staffCommissionRates_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "sms_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffCommissionRates" ADD CONSTRAINT "sms_staffCommissionRates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "sms_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffContacts" ADD CONSTRAINT "sms_staffContacts_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "sms_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffDesignations" ADD CONSTRAINT "sms_staffDesignations_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "sms_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffDocuments" ADD CONSTRAINT "sms_staffDocuments_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "sms_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffDocuments" ADD CONSTRAINT "sms_staffDocuments_supersedesDocumentId_fkey" FOREIGN KEY ("supersedesDocumentId") REFERENCES "sms_staffDocuments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffDocuments" ADD CONSTRAINT "sms_staffDocuments_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "sms_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffEmergencyContacts" ADD CONSTRAINT "sms_staffEmergencyContacts_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "sms_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffEmploymentHistory" ADD CONSTRAINT "sms_staffEmploymentHistory_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "sms_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffEmploymentHistory" ADD CONSTRAINT "sms_staffEmploymentHistory_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "sms_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffLeaveBalances" ADD CONSTRAINT "sms_staffLeaveBalances_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "sms_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffLeaveBalances" ADD CONSTRAINT "sms_staffLeaveBalances_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "sms_leaveTypes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffLeaveRequests" ADD CONSTRAINT "sms_staffLeaveRequests_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "sms_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffLeaveRequests" ADD CONSTRAINT "sms_staffLeaveRequests_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "sms_leaveTypes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffPermissionOverrides" ADD CONSTRAINT "sms_staffPermissionOverrides_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "sms_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffPermissionOverrides" ADD CONSTRAINT "sms_staffPermissionOverrides_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "sms_permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffPermissionOverrides" ADD CONSTRAINT "sms_staffPermissionOverrides_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "sms_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffPermissionOverrides" ADD CONSTRAINT "sms_staffPermissionOverrides_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "sms_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffQualifications" ADD CONSTRAINT "sms_staffQualifications_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "sms_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffScheduleOverrides" ADD CONSTRAINT "sms_staffScheduleOverrides_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "sms_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffScheduleOverrides" ADD CONSTRAINT "sms_staffScheduleOverrides_linkedSwapId_fkey" FOREIGN KEY ("linkedSwapId") REFERENCES "sms_staffScheduleOverrides"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffScheduleOverrides" ADD CONSTRAINT "sms_staffScheduleOverrides_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "sms_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffScheduleOverrides" ADD CONSTRAINT "sms_staffScheduleOverrides_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "sms_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffServiceBranchOverrides" ADD CONSTRAINT "sms_staffServiceBranchOverrides_staffServiceId_fkey" FOREIGN KEY ("staffServiceId") REFERENCES "sms_staffServices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffServiceBranchOverrides" ADD CONSTRAINT "sms_staffServiceBranchOverrides_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "sms_branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffServiceBranchOverrides" ADD CONSTRAINT "sms_staffServiceBranchOverrides_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "sms_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffServices" ADD CONSTRAINT "sms_staffServices_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "sms_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffServices" ADD CONSTRAINT "sms_staffServices_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "sms_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffServices" ADD CONSTRAINT "sms_staffServices_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "sms_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffSkillRatings" ADD CONSTRAINT "sms_staffSkillRatings_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "sms_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffSkillRatings" ADD CONSTRAINT "sms_staffSkillRatings_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "sms_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffWeeklySchedules" ADD CONSTRAINT "sms_staffWeeklySchedules_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "sms_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffWeeklySchedules" ADD CONSTRAINT "sms_staffWeeklySchedules_shiftTemplateId_fkey" FOREIGN KEY ("shiftTemplateId") REFERENCES "sms_shiftTemplates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_staffWeeklySchedules" ADD CONSTRAINT "sms_staffWeeklySchedules_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "sms_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_userBranchAssignments" ADD CONSTRAINT "sms_userBranchAssignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "sms_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_userBranchAssignments" ADD CONSTRAINT "sms_userBranchAssignments_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "sms_branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_userBranchAssignments" ADD CONSTRAINT "sms_userBranchAssignments_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "sms_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_userPasswordResets" ADD CONSTRAINT "sms_userPasswordResets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "sms_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_userRoles" ADD CONSTRAINT "sms_userRoles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "sms_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_userRoles" ADD CONSTRAINT "sms_userRoles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "sms_roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_userRoles" ADD CONSTRAINT "sms_userRoles_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "sms_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_userSessions" ADD CONSTRAINT "sms_userSessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "sms_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_userStatusLogs" ADD CONSTRAINT "sms_userStatusLogs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "sms_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_userStatusLogs" ADD CONSTRAINT "sms_userStatusLogs_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "sms_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_userTwoFactorSettings" ADD CONSTRAINT "sms_userTwoFactorSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "sms_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_users" ADD CONSTRAINT "sms_users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "sms_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_users" ADD CONSTRAINT "sms_users_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "sms_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
