<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260413100000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add vma column to eleve table';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE eleve ADD vma DOUBLE PRECISION DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE eleve DROP COLUMN vma');
    }
}
