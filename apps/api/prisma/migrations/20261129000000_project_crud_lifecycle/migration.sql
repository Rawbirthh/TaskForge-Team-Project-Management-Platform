-- CreateTable
CREATE TABLE `projects` (
    `id` VARCHAR(191) NOT NULL,
    `workspace_id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(16) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `description` VARCHAR(2000) NULL,
    `visibility` ENUM('WORKSPACE', 'PRIVATE') NOT NULL DEFAULT 'WORKSPACE',
    `status` ENUM('ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `start_date` DATE NULL,
    `target_date` DATE NULL,
    `created_by_user_id` VARCHAR(191) NOT NULL,
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `projects_workspace_id_status_visibility_idx`(`workspace_id`, `status`, `visibility`),
    INDEX `projects_workspace_id_updated_at_id_idx`(`workspace_id`, `updated_at`, `id`),
    INDEX `projects_workspace_id_created_at_idx`(`workspace_id`, `created_at`),
    UNIQUE INDEX `projects_workspace_id_key_key`(`workspace_id`, `key`),
    UNIQUE INDEX `projects_workspace_id_name_key`(`workspace_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `projects` ADD CONSTRAINT `projects_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `projects` ADD CONSTRAINT `projects_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
