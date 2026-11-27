-- AlterTable
ALTER TABLE `users` ADD COLUMN `avatar_url` VARCHAR(500) NULL,
    ADD COLUMN `deactivated_at` DATETIME(3) NULL,
    ADD COLUMN `deletion_requested_at` DATETIME(3) NULL,
    ADD COLUMN `locale` VARCHAR(35) NULL,
    ADD COLUMN `pending_email` VARCHAR(254) NULL,
    ADD COLUMN `time_zone` VARCHAR(64) NOT NULL DEFAULT 'UTC';

-- CreateTable
CREATE TABLE `email_change_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `new_email` VARCHAR(254) NOT NULL,
    `token_hash` VARCHAR(191) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `email_change_tokens_token_hash_key`(`token_hash`),
    INDEX `email_change_tokens_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `users_pending_email_key` ON `users`(`pending_email`);

-- AddForeignKey
ALTER TABLE `email_change_tokens` ADD CONSTRAINT `email_change_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
