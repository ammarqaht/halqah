-- CreateTable
CREATE TABLE "point_txns" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "ref_type" TEXT,
    "ref_id" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "point_txns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "point_code_batches" (
    "id" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT '',
    "quantity" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "point_code_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "point_codes" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "redeemed_by" TEXT,
    "redeemed_at" TIMESTAMP(3),

    CONSTRAINT "point_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gifts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "image" TEXT,
    "points_cost" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "low_stock_threshold" INTEGER NOT NULL DEFAULT 3,
    "category" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'VISIBLE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "student_id" TEXT NOT NULL,
    "gift_id" TEXT NOT NULL,
    "points_spent" INTEGER NOT NULL,
    "gift_name_snapshot" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivered_at" TIMESTAMP(3),
    "cancelled_reason" TEXT,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exams" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "halaqa_id" TEXT,
    "track" TEXT,
    "type" TEXT NOT NULL,
    "taken_on" TEXT NOT NULL,
    "level" INTEGER,
    "ajza" INTEGER,
    "errors" INTEGER,
    "warnings" INTEGER,
    "tajweed_errors" INTEGER,
    "score" INTEGER,
    "passed" BOOLEAN,
    "points_awarded" INTEGER NOT NULL DEFAULT 0,
    "points_paid" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT NOT NULL DEFAULT '',
    "examiner" TEXT NOT NULL DEFAULT '',
    "tajweed_topics" TEXT[],
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_questions" (
    "id" TEXT NOT NULL,
    "exam_id" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "surah" TEXT NOT NULL DEFAULT '',
    "ayah_from" TEXT NOT NULL DEFAULT '',
    "ayah_to" TEXT NOT NULL DEFAULT '',
    "errors" INTEGER NOT NULL DEFAULT 0,
    "warnings" INTEGER NOT NULL DEFAULT 0,
    "tajweed_errors" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "exam_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_bookings" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "scheduled_on" TEXT NOT NULL,
    "level" INTEGER,
    "badge" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'BOOKED',
    "exam_id" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curriculum_days" (
    "track" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "day_no" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "from_surah" TEXT NOT NULL DEFAULT '',
    "from_ayah" TEXT NOT NULL DEFAULT '',
    "to_surah" TEXT NOT NULL DEFAULT '',
    "to_ayah" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "curriculum_days_pkey" PRIMARY KEY ("track","level","day_no","kind")
);

-- CreateTable
CREATE TABLE "student_plans" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "track" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "issued_at" TEXT NOT NULL,
    "issued_by" TEXT,
    "day_count" INTEGER NOT NULL DEFAULT 24,
    "exam_days" JSONB NOT NULL,
    "daily_amount" TEXT NOT NULL DEFAULT '',
    "printed_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tajweed_topics" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tajweed_topics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "point_txns_student_id_idx" ON "point_txns"("student_id");

-- CreateIndex
CREATE INDEX "point_txns_ref_type_ref_id_idx" ON "point_txns"("ref_type", "ref_id");

-- CreateIndex
CREATE UNIQUE INDEX "point_codes_code_key" ON "point_codes"("code");

-- CreateIndex
CREATE INDEX "point_codes_batch_id_idx" ON "point_codes"("batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_number_key" ON "orders"("number");

-- CreateIndex
CREATE INDEX "orders_student_id_idx" ON "orders"("student_id");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "exams_student_id_idx" ON "exams"("student_id");

-- CreateIndex
CREATE INDEX "exams_taken_on_idx" ON "exams"("taken_on");

-- CreateIndex
CREATE INDEX "exam_questions_exam_id_idx" ON "exam_questions"("exam_id");

-- CreateIndex
CREATE INDEX "exam_bookings_scheduled_on_idx" ON "exam_bookings"("scheduled_on");

-- CreateIndex
CREATE INDEX "exam_bookings_student_id_idx" ON "exam_bookings"("student_id");

-- CreateIndex
CREATE INDEX "curriculum_days_track_level_idx" ON "curriculum_days"("track", "level");

-- CreateIndex
CREATE INDEX "student_plans_student_id_idx" ON "student_plans"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_plans_student_id_track_level_key" ON "student_plans"("student_id", "track", "level");

-- CreateIndex
CREATE UNIQUE INDEX "tajweed_topics_name_key" ON "tajweed_topics"("name");

-- AddForeignKey
ALTER TABLE "point_txns" ADD CONSTRAINT "point_txns_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_codes" ADD CONSTRAINT "point_codes_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "point_code_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_gift_id_fkey" FOREIGN KEY ("gift_id") REFERENCES "gifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_bookings" ADD CONSTRAINT "exam_bookings_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_plans" ADD CONSTRAINT "student_plans_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
