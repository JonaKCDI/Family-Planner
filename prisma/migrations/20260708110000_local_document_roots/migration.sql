ALTER TYPE "DocumentReferenceType" ADD VALUE IF NOT EXISTS 'LOCAL_FILE';

CREATE TABLE "DocumentRoot" (
  "id" TEXT NOT NULL,
  "familyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "basePath" TEXT NOT NULL,
  "scope" "Scope" NOT NULL DEFAULT 'FAMILY',
  "createdByUserId" TEXT,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DocumentRoot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentRootAccess" (
  "id" TEXT NOT NULL,
  "documentRootId" TEXT NOT NULL,
  "userId" TEXT,
  "role" "FamilyRole",
  "canRead" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentRootAccess_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DocumentReference"
  ADD COLUMN "documentRootId" TEXT,
  ADD COLUMN "relativePath" TEXT,
  ADD COLUMN "fileName" TEXT,
  ADD COLUMN "mimeType" TEXT,
  ADD COLUMN "fileSize" INTEGER,
  ADD COLUMN "lastSeenAt" TIMESTAMP(3);

CREATE INDEX "DocumentRoot_familyId_archivedAt_idx" ON "DocumentRoot"("familyId", "archivedAt");
CREATE INDEX "DocumentRoot_createdByUserId_idx" ON "DocumentRoot"("createdByUserId");
CREATE INDEX "DocumentRootAccess_documentRootId_idx" ON "DocumentRootAccess"("documentRootId");
CREATE INDEX "DocumentRootAccess_userId_idx" ON "DocumentRootAccess"("userId");
CREATE UNIQUE INDEX "DocumentRootAccess_documentRootId_userId_key" ON "DocumentRootAccess"("documentRootId", "userId");
CREATE UNIQUE INDEX "DocumentRootAccess_documentRootId_role_key" ON "DocumentRootAccess"("documentRootId", "role");
CREATE INDEX "DocumentReference_documentRootId_idx" ON "DocumentReference"("documentRootId");

ALTER TABLE "DocumentRoot"
  ADD CONSTRAINT "DocumentRoot_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "DocumentRoot_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DocumentRootAccess"
  ADD CONSTRAINT "DocumentRootAccess_documentRootId_fkey" FOREIGN KEY ("documentRootId") REFERENCES "DocumentRoot"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "DocumentRootAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DocumentReference"
  ADD CONSTRAINT "DocumentReference_documentRootId_fkey" FOREIGN KEY ("documentRootId") REFERENCES "DocumentRoot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
