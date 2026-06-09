-- CreateTable
CREATE TABLE "AdminRecoveryKey" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminRecoveryKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminRecoveryKey_familyId_key" ON "AdminRecoveryKey"("familyId");

-- CreateIndex
CREATE INDEX "AdminRecoveryKey_createdByUserId_idx" ON "AdminRecoveryKey"("createdByUserId");

-- AddForeignKey
ALTER TABLE "AdminRecoveryKey" ADD CONSTRAINT "AdminRecoveryKey_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminRecoveryKey" ADD CONSTRAINT "AdminRecoveryKey_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
