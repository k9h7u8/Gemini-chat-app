/*
  Warnings:

  - The values [INACTIVE,BASIC,PRO,PENDING,CANCELED,PAST_DUE,UNPAID] on the enum `SubscriptionStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `createdAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `refreshToken` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `stripeCustomerId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `stripeSubscriptionId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `subscriptionEndDate` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `username` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `senderId` on the `messages` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "SenderType" AS ENUM ('User', 'AI');

-- AlterEnum
BEGIN;
CREATE TYPE "SubscriptionStatus_new" AS ENUM ('Basic', 'Pro');
ALTER TABLE "User" ALTER COLUMN "subscriptionStatus" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "subscriptionStatus" TYPE "SubscriptionStatus_new" USING ("subscriptionStatus"::text::"SubscriptionStatus_new");
ALTER TYPE "SubscriptionStatus" RENAME TO "SubscriptionStatus_old";
ALTER TYPE "SubscriptionStatus_new" RENAME TO "SubscriptionStatus";
DROP TYPE "SubscriptionStatus_old";
ALTER TABLE "User" ALTER COLUMN "subscriptionStatus" SET DEFAULT 'Basic';
COMMIT;

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_senderId_fkey";

-- DropIndex
DROP INDEX "User_email_key";

-- DropIndex
DROP INDEX "User_stripeCustomerId_key";

-- DropIndex
DROP INDEX "User_stripeSubscriptionId_key";

-- DropIndex
DROP INDEX "User_username_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "createdAt",
DROP COLUMN "email",
DROP COLUMN "refreshToken",
DROP COLUMN "stripeCustomerId",
DROP COLUMN "stripeSubscriptionId",
DROP COLUMN "subscriptionEndDate",
DROP COLUMN "updatedAt",
DROP COLUMN "username",
ALTER COLUMN "subscriptionStatus" SET DEFAULT 'Basic';

-- AlterTable
ALTER TABLE "messages" DROP COLUMN "senderId";
