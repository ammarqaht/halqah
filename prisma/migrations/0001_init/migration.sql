-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Track" AS ENUM ('TALQEEN', 'SILVER', 'GOLDEN');

-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'GRADUATED');

-- CreateEnum
CREATE TYPE "IdFlag" AS ENUM ('SHORT', 'LONG', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPERVISOR');

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'SUPERVISOR',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "halaqat" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "teacher" TEXT NOT NULL,
    "mosque" TEXT NOT NULL DEFAULT 'جامع محمد العبدالكريم — حي أُحد',
    "time_slot" TEXT NOT NULL DEFAULT 'العصر',
    "track" "Track",
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "halaqat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "national_id" TEXT,
    "national_id_flag" "IdFlag",
    "dedupe_key" TEXT,
    "track" "Track",
    "halaqa_id" TEXT,
    "grade" TEXT NOT NULL DEFAULT '',
    "stage" TEXT NOT NULL DEFAULT '',
    "nationality" TEXT NOT NULL DEFAULT '',
    "guardian_phone" TEXT NOT NULL DEFAULT '',
    "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
    "current_level" INTEGER,
    "attended" BOOLEAN,
    "hifz_pages" DECIMAL(6,2),
    "review_pages" DECIMAL(6,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "halaqa_transfers" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "from_halaqa_id" TEXT,
    "to_halaqa_id" TEXT,
    "reason" TEXT,
    "moved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "moved_by" TEXT,

    CONSTRAINT "halaqa_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_runs" (
    "id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "sheet_name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "row_count" INTEGER NOT NULL,
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "flagged" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "imported_by" TEXT,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "before" JSONB,
    "after" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_username_key" ON "admin_users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "halaqat_name_key" ON "halaqat"("name");

-- CreateIndex
CREATE INDEX "halaqat_mosque_time_slot_idx" ON "halaqat"("mosque", "time_slot");

-- CreateIndex
CREATE UNIQUE INDEX "students_dedupe_key_key" ON "students"("dedupe_key");

-- CreateIndex
CREATE INDEX "students_halaqa_id_idx" ON "students"("halaqa_id");

-- CreateIndex
CREATE INDEX "students_track_idx" ON "students"("track");

-- CreateIndex
CREATE INDEX "students_status_idx" ON "students"("status");

-- CreateIndex
CREATE INDEX "students_national_id_idx" ON "students"("national_id");

-- CreateIndex
CREATE INDEX "halaqa_transfers_student_id_moved_at_idx" ON "halaqa_transfers"("student_id", "moved_at");

-- CreateIndex
CREATE INDEX "import_runs_imported_at_idx" ON "import_runs"("imported_at");

-- CreateIndex
CREATE INDEX "audit_log_entity_entity_id_at_idx" ON "audit_log"("entity", "entity_id", "at");

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_halaqa_id_fkey" FOREIGN KEY ("halaqa_id") REFERENCES "halaqat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "halaqa_transfers" ADD CONSTRAINT "halaqa_transfers_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

