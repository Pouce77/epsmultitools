<?php

namespace App\Repository;

use App\Entity\Classe;
use App\Entity\Eleve;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Eleve>
 */
class EleveRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Eleve::class);
    }

    /**
     * @return Eleve[]
     */
    public function findByClasse(Classe $classe): array
    {
        return $this->createQueryBuilder('e')
            ->andWhere('e.classe = :classe')
            ->setParameter('classe', $classe)
            ->orderBy('e.nom', 'ASC')
            ->addOrderBy('e.prenom', 'ASC')
            ->getQuery()
            ->getResult();
    }

    public function countByClasse(Classe $classe): int
    {
        return (int) $this->createQueryBuilder('e')
            ->select('COUNT(e.id)')
            ->andWhere('e.classe = :classe')
            ->setParameter('classe', $classe)
            ->getQuery()
            ->getSingleScalarResult();
    }
}
