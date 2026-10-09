DO $$
BEGIN
  CREATE TYPE "sms_organizationSettings_currencySymbolPosition" AS ENUM ('prefix', 'suffix');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "sms_organization_settings"
  ADD COLUMN IF NOT EXISTS "currencySymbolPosition" "sms_organizationSettings_currencySymbolPosition" NOT NULL DEFAULT 'prefix',
  ADD COLUMN IF NOT EXISTS "currencyDecimalPlaces" SMALLINT NOT NULL DEFAULT 2;

ALTER TABLE "sms_organizations"
  ADD COLUMN IF NOT EXISTS "slugChangedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "logoSquareUrl" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "logoWideUrl" VARCHAR(500);
