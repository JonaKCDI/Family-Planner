-- CreateEnum
CREATE TYPE "RecurringTaskStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RecurringTaskIntervalUnit" AS ENUM ('DAY', 'MONTH', 'YEAR');

-- AlterTable
ALTER TABLE "Task"
ADD COLUMN "recurringTaskId" TEXT,
ADD COLUMN "recurringTaskDueDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "RecurringTask" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "assignedToUserId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "scope" "Scope" NOT NULL DEFAULT 'FAMILY',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "intervalCount" INTEGER NOT NULL DEFAULT 1,
    "intervalUnit" "RecurringTaskIntervalUnit" NOT NULL DEFAULT 'MONTH',
    "leadTimeDays" INTEGER NOT NULL,
    "nextDueDate" TIMESTAMP(3),
    "status" "RecurringTaskStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Task_recurringTaskId_idx" ON "Task"("recurringTaskId");

-- CreateIndex
CREATE UNIQUE INDEX "Task_recurringTaskId_recurringTaskDueDate_key" ON "Task"("recurringTaskId", "recurringTaskDueDate");

-- CreateIndex
CREATE INDEX "RecurringTask_familyId_status_nextDueDate_idx" ON "RecurringTask"("familyId", "status", "nextDueDate");

-- CreateIndex
CREATE INDEX "RecurringTask_ownerUserId_idx" ON "RecurringTask"("ownerUserId");

-- CreateIndex
CREATE INDEX "RecurringTask_assignedToUserId_idx" ON "RecurringTask"("assignedToUserId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_recurringTaskId_fkey" FOREIGN KEY ("recurringTaskId") REFERENCES "RecurringTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringTask" ADD CONSTRAINT "RecurringTask_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringTask" ADD CONSTRAINT "RecurringTask_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringTask" ADD CONSTRAINT "RecurringTask_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
