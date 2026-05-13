ALTER TABLE "CalendarIntegration"
ADD COLUMN "encryptedAccessToken" TEXT,
ADD COLUMN "encryptedRefreshToken" TEXT,
ADD COLUMN "tokenExpiresAt" TIMESTAMP(3),
ADD COLUMN "externalAccountEmail" TEXT;
