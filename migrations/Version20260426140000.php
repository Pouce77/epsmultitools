<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260426140000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Create user_feedback table';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE TABLE user_feedback (
            id INT AUTO_INCREMENT NOT NULL,
            user_id INT DEFAULT NULL,
            user_label VARCHAR(200) DEFAULT NULL,
            sujet VARCHAR(150) NOT NULL,
            contenu LONGTEXT NOT NULL,
            lu TINYINT(1) DEFAULT 0 NOT NULL,
            created_at DATETIME NOT NULL COMMENT \'(DC2Type:datetime_immutable)\',
            INDEX IDX_feedback_created (created_at),
            PRIMARY KEY(id)
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');

        $this->addSql('ALTER TABLE user_feedback
            ADD CONSTRAINT FK_feedback_user FOREIGN KEY (user_id) REFERENCES `user` (id) ON DELETE SET NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE user_feedback DROP FOREIGN KEY FK_feedback_user');
        $this->addSql('DROP TABLE user_feedback');
    }
}
