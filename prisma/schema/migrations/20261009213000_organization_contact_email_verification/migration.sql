ALTER TABLE "sms_organization_contacts"
  ADD COLUMN IF NOT EXISTS "emailVerificationTokenHash" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "emailVerificationExpiresAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "sms_organization_contacts_emailVerificationTokenHash_idx"
  ON "sms_organization_contacts"("emailVerificationTokenHash");
