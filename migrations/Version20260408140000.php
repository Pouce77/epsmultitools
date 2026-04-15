<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260408140000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add niveau column to eleve table';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE eleve ADD niveau SMALLINT DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE eleve DROP COLUMN niveau');
    }
}
