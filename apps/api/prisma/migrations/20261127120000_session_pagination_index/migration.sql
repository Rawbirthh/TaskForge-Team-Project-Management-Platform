-- CreateIndex
CREATE INDEX `sessions_user_id_created_at_idx` ON `sessions`(`user_id`, `created_at`);

-- DropIndex
DROP INDEX `sessions_user_id_idx` ON `sessions`;
