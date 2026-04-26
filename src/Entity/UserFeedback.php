<?php

namespace App\Entity;

use App\Repository\UserFeedbackRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: UserFeedbackRepository::class)]
#[ORM\Index(columns: ['created_at'])]
class UserFeedback
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $user = null;

    #[ORM\Column(length: 200, nullable: true)]
    private ?string $userLabel = null;

    #[ORM\Column(length: 150)]
    private string $sujet = '';

    #[ORM\Column(type: 'text')]
    private string $contenu = '';

    #[ORM\Column(options: ['default' => false])]
    private bool $lu = false;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): ?int { return $this->id; }
    public function getUser(): ?User { return $this->user; }
    public function setUser(?User $user): static { $this->user = $user; return $this; }
    public function getUserLabel(): ?string { return $this->userLabel; }
    public function setUserLabel(?string $label): static { $this->userLabel = $label; return $this; }
    public function getSujet(): string { return $this->sujet; }
    public function setSujet(string $sujet): static { $this->sujet = $sujet; return $this; }
    public function getContenu(): string { return $this->contenu; }
    public function setContenu(string $contenu): static { $this->contenu = $contenu; return $this; }
    public function isLu(): bool { return $this->lu; }
    public function setLu(bool $lu): static { $this->lu = $lu; return $this; }
    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
}
