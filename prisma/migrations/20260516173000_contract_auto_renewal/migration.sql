-- Track automatically renewing contracts so cancellation deadlines can roll forward.
ALTER TABLE "Contract" ADD COLUMN "autoRenewal" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Contract" ADD COLUMN "renewalInterval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY';
ALTER TABLE "Contract" ADD COLUMN "renewalAnchorDay" INTEGER;
