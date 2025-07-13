/*
  Warnings:

  - You are about to drop the `Chatroom` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Message` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Chatroom" DROP CONSTRAINT "Chatroom_userId_fkey";

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_chatroomId_fkey";

-- DropTable
DROP TABLE "Chatroom";

-- DropTable
DROP TABLE "Message";

-- CreateTable
CREATE TABLE "chatrooms" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "creator_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chatrooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isFromGemini" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chatroom_id" TEXT NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "chatrooms" ADD CONSTRAINT "chatrooms_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_chatroom_id_fkey" FOREIGN KEY ("chatroom_id") REFERENCES "chatrooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
