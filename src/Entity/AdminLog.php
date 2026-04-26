<?php

namespace App\Entity;

use App\Repository\AdminLogRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: AdminLogRepository::class)]
#[ORM\Index(columns: ['created_at'])]
class AdminLog
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 100)]
    private string $action = '';

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $details = null;

    // FK nulled on user deletion — label columns preserve identity
    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $admin = null;

    #[ORM\Column(length: 200, nullable: true)]
    private ?string $adminLabel = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $targetUser = null;

    #[ORM\Column(length: 200, nullable: true)]
    private ?string $targetUserLabel = null;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): ?int { return $this->id; }
    public function getAction(): string { return $this->action; }
    public function setAction(string $action): static { $this->action = $action; return $this; }
    public function getDetails(): ?string { return $this->details; }
    public function setDetails(?string $details): static { $this->details = $details; return $this; }
    public function getAdmin(): ?User { return $this->admin; }
    public function setAdmin(?User $admin): static { $this->admin = $admin; return $this; }
    public function getAdminLabel(): ?string { return $this->adminLabel; }
    public function setAdminLabel(?string $label): static { $this->adminLabel = $label; return $this; }
    public function getTargetUser(): ?User { return $this->targetUser; }
    public function setTargetUser(?User $user): static { $this->targetUser = $user; return $this; }
    public function getTargetUserLabel(): ?string { return $this->targetUserLabel; }
    public function setTargetUserLabel(?string $label): static { $this->targetUserLabel = $label; return $this; }
    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
}
