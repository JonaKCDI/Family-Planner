CREATE TABLE "FamilyTransfer" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "date" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FamilyTransfer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FamilyTransfer_familyId_date_idx" ON "FamilyTransfer"("familyId", "date");
CREATE INDEX "FamilyTransfer_senderUserId_idx" ON "FamilyTransfer"("senderUserId");
CREATE INDEX "FamilyTransfer_recipientUserId_idx" ON "FamilyTransfer"("recipientUserId");
CREATE INDEX "FamilyTransfer_createdByUserId_idx" ON "FamilyTransfer"("createdByUserId");

ALTER TABLE "FamilyTransfer" ADD CONSTRAINT "FamilyTransfer_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FamilyTransfer" ADD CONSTRAINT "FamilyTransfer_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FamilyTransfer" ADD CONSTRAINT "FamilyTransfer_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FamilyTransfer" ADD CONSTRAINT "FamilyTransfer_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
