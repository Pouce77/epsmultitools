<?php

namespace App\Repository;

use App\Entity\GlobalMessage;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<GlobalMessage> */
class GlobalMessageRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, GlobalMessage::class);
    }

    public function findActive(): ?GlobalMessage
    {
        return $this->findOneBy(['actif' => true], ['createdAt' => 'DESC']);
    }
}
