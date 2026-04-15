<?php

namespace App\Repository;

use App\Entity\Classe;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Classe>
 */
class ClasseRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Classe::class);
    }

    /**
     * @return Classe[]
     */
    public function findByEnseignant(User $user): array
    {
        return $this->createQueryBuilder('c')
            ->andWhere('c.enseignant = :user')
            ->setParameter('user', $user)
            ->orderBy('c.anneeScolaire', 'DESC')
            ->addOrderBy('c.nom', 'ASC')
            ->getQuery()
            ->getResult();
    }

    public function findOneByIdAndEnseignant(int $id, User $user): ?Classe
    {
        return $this->createQueryBuilder('c')
            ->andWhere('c.id = :id')
            ->andWhere('c.enseignant = :user')
            ->setParameter('id', $id)
            ->setParameter('user', $user)
            ->getQuery()
            ->getOneOrNullResult();
    }
}
