<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260426120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Create global_message table';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE TABLE global_message (
            id INT AUTO_INCREMENT NOT NULL,
            contenu LONGTEXT NOT NULL,
            type VARCHAR(20) NOT NULL,
            actif TINYINT(1) DEFAULT 1 NOT NULL,
            created_at DATETIME NOT NULL COMMENT \'(DC2Type:datetime_immutable)\',
            PRIMARY KEY(id)
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE global_message');
    }
}
