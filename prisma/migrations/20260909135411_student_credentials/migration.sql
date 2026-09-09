-- CreateTable
CREATE TABLE "student_credentials" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "pin_hash" TEXT NOT NULL,
    "must_change_pin" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "student_credentials_student_id_key" ON "student_credentials"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_credentials_username_key" ON "student_credentials"("username");

-- AddForeignKey
ALTER TABLE "student_credentials" ADD CONSTRAINT "student_credentials_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

