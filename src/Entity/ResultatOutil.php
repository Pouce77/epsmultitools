<?php

namespace App\Entity;

use App\Repository\ResultatOutilRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: ResultatOutilRepository::class)]
class ResultatOutil
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    /** vitesse | actions | scores | tournoi | equipes | impacts */
    #[ORM\Column(length: 30)]
    private string $outil;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Classe $classe;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false)]
    private User $enseignant;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(type: Types::JSON)]
    private array $data = [];

    #[ORM\Column(length: 200, nullable: true)]
    private ?string $label = null;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): ?int { return $this->id; }

    public function getOutil(): string { return $this->outil; }
    public function setOutil(string $outil): static { $this->outil = $outil; return $this; }

    public function getClasse(): Classe { return $this->classe; }
    public function setClasse(Classe $classe): static { $this->classe = $classe; return $this; }

    public function getEnseignant(): User { return $this->enseignant; }
    public function setEnseignant(User $enseignant): static { $this->enseignant = $enseignant; return $this; }

    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }

    public function getData(): array { return $this->data; }
    public function setData(array $data): static { $this->data = $data; return $this; }

    public function getLabel(): ?string { return $this->label; }
    public function setLabel(?string $label): static { $this->label = $label ?: null; return $this; }

    public function getOutilLabel(): string
    {
        return match ($this->outil) {
            'vitesse'  => 'Vitesse – Demi-fond',
            'actions'  => 'Compteur d\'actions',
            'scores'   => 'Tableau de scores',
            'tournoi'  => 'Tournoi',
            'equipes'  => 'Équipes équilibrées',
            'impacts'  => 'Marqueur d\'impacts',
            default    => ucfirst($this->outil),
        };
    }

    public function getOutilIcon(): string
    {
        return match ($this->outil) {
            'vitesse'  => '⏱️',
            'actions'  => '📊',
            'scores'   => '🏆',
            'tournoi'  => '🎯',
            'equipes'  => '⚖️',
            'impacts'  => '🎾',
            default    => '📁',
        };
    }
}
