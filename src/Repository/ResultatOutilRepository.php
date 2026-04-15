<?php

namespace App\Repository;

use App\Entity\ResultatOutil;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<ResultatOutil>
 */
class ResultatOutilRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, ResultatOutil::class);
    }

    /**
     * @return ResultatOutil[]
     */
    public function findByEnseignantFiltered(User $user, array $filters = []): array
    {
        $qb = $this->createQueryBuilder('r')
            ->join('r.classe', 'c')
            ->andWhere('r.enseignant = :user')
            ->setParameter('user', $user)
            ->orderBy('r.createdAt', 'DESC');

        if (!empty($filters['outil'])) {
            $qb->andWhere('r.outil = :outil')
               ->setParameter('outil', $filters['outil']);
        }

        if (!empty($filters['classeId'])) {
            $qb->andWhere('c.id = :classeId')
               ->setParameter('classeId', (int) $filters['classeId']);
        }

        if (!empty($filters['dateFrom'])) {
            $qb->andWhere('r.createdAt >= :dateFrom')
               ->setParameter('dateFrom', new \DateTimeImmutable($filters['dateFrom']));
        }

        if (!empty($filters['dateTo'])) {
            $qb->andWhere('r.createdAt <= :dateTo')
               ->setParameter('dateTo', (new \DateTimeImmutable($filters['dateTo']))->setTime(23, 59, 59));
        }

        return $qb->getQuery()->getResult();
    }
}
