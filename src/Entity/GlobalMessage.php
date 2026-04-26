<?php

namespace App\Entity;

use App\Repository\GlobalMessageRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: GlobalMessageRepository::class)]
class GlobalMessage
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(type: 'text')]
    private string $contenu = '';

    #[ORM\Column(length: 20)]
    private string $type = 'info'; // info | success | warning | danger

    #[ORM\Column(options: ['default' => true])]
    private bool $actif = true;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): ?int { return $this->id; }
    public function getContenu(): string { return $this->contenu; }
    public function setContenu(string $contenu): static { $this->contenu = $contenu; return $this; }
    public function getType(): string { return $this->type; }
    public function setType(string $type): static { $this->type = $type; return $this; }
    public function isActif(): bool { return $this->actif; }
    public function setActif(bool $actif): static { $this->actif = $actif; return $this; }
    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
}
