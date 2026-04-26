<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260426130000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Create admin_log table';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE TABLE admin_log (
            id INT AUTO_INCREMENT NOT NULL,
            admin_id INT DEFAULT NULL,
            target_user_id INT DEFAULT NULL,
            action VARCHAR(100) NOT NULL,
            details LONGTEXT DEFAULT NULL,
            admin_label VARCHAR(200) DEFAULT NULL,
            target_user_label VARCHAR(200) DEFAULT NULL,
            created_at DATETIME NOT NULL COMMENT \'(DC2Type:datetime_immutable)\',
            INDEX IDX_admin_log_created (created_at),
            PRIMARY KEY(id)
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');

        $this->addSql('ALTER TABLE admin_log
            ADD CONSTRAINT FK_admin_log_admin FOREIGN KEY (admin_id) REFERENCES `user` (id) ON DELETE SET NULL,
            ADD CONSTRAINT FK_admin_log_target FOREIGN KEY (target_user_id) REFERENCES `user` (id) ON DELETE SET NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE admin_log DROP FOREIGN KEY FK_admin_log_admin');
        $this->addSql('ALTER TABLE admin_log DROP FOREIGN KEY FK_admin_log_target');
        $this->addSql('DROP TABLE admin_log');
    }
}
