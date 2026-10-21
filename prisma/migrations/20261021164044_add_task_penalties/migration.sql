-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('PERSONAL', 'TEAM');

-- CreateTable
CREATE TABLE "penalty_settings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "personal_tasks_enabled" BOOLEAN NOT NULL DEFAULT true,
    "team_tasks_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "penalty_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_penalties" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "task_type" "TaskType" NOT NULL,
    "user_id" TEXT NOT NULL,
    "team_id" TEXT,
    "penalty_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadline" TIMESTAMP(3) NOT NULL,
    "month_year" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_penalties_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "penalty_settings_user_id_key" ON "penalty_settings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_penalties_task_id_key" ON "task_penalties"("task_id");

-- CreateIndex
CREATE INDEX "task_penalties_user_id_month_year_idx" ON "task_penalties"("user_id", "month_year");

-- CreateIndex
CREATE INDEX "task_penalties_team_id_month_year_idx" ON "task_penalties"("team_id", "month_year");

-- CreateIndex
CREATE INDEX "task_penalties_task_type_month_year_idx" ON "task_penalties"("task_type", "month_year");

-- AddForeignKey
ALTER TABLE "penalty_settings" ADD CONSTRAINT "penalty_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_penalties" ADD CONSTRAINT "task_penalties_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_penalties" ADD CONSTRAINT "task_penalties_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_penalties" ADD CONSTRAINT "task_penalties_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
