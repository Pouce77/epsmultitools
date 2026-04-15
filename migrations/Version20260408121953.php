<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260408121953 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE resultat_outil (id INT AUTO_INCREMENT NOT NULL, outil VARCHAR(30) NOT NULL, created_at DATETIME NOT NULL, data JSON NOT NULL, label VARCHAR(200) DEFAULT NULL, classe_id INT NOT NULL, enseignant_id INT NOT NULL, INDEX IDX_6EADDFEC8F5EA509 (classe_id), INDEX IDX_6EADDFECE455FCC0 (enseignant_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('ALTER TABLE resultat_outil ADD CONSTRAINT FK_6EADDFEC8F5EA509 FOREIGN KEY (classe_id) REFERENCES classe (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE resultat_outil ADD CONSTRAINT FK_6EADDFECE455FCC0 FOREIGN KEY (enseignant_id) REFERENCES `user` (id)');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE resultat_outil DROP FOREIGN KEY FK_6EADDFEC8F5EA509');
        $this->addSql('ALTER TABLE resultat_outil DROP FOREIGN KEY FK_6EADDFECE455FCC0');
        $this->addSql('DROP TABLE resultat_outil');
    }
}
