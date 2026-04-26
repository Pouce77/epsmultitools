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

    public function countTotal(): int
    {
        return $this->count([]);
    }

    public function countByOutil(): array
    {
        return $this->createQueryBuilder('r')
            ->select('r.outil, COUNT(r.id) AS nb')
            ->groupBy('r.outil')
            ->orderBy('nb', 'DESC')
            ->getQuery()->getResult();
    }

    /** @return ResultatOutil[] */
    public function findByEnseignant(User $user): array
    {
        return $this->createQueryBuilder('r')
            ->andWhere('r.enseignant = :user')
            ->setParameter('user', $user)
            ->orderBy('r.createdAt', 'DESC')
            ->getQuery()->getResult();
    }

    /**
     * Returns a 7×24 matrix [dayIndex][hour] => count.
     * dayIndex: 0=Lun … 6=Dim, hour: 0-23.
     */
    public function getActivityHeatmap(): array
    {
        $conn = $this->getEntityManager()->getConnection();
        $matrix = array_fill(0, 7, array_fill(0, 24, 0));

        $rows = $conn->fetchAllAssociative(
            'SELECT DAYOFWEEK(created_at) AS dow, HOUR(created_at) AS h, COUNT(*) AS cnt
             FROM resultat_outil
             GROUP BY dow, h'
        );

        foreach ($rows as $row) {
            // MySQL DAYOFWEEK: 1=Dim, 2=Lun, …, 7=Sam → 0=Lun … 6=Dim
            $dayIndex = ($row['dow'] + 5) % 7;
            $matrix[$dayIndex][(int) $row['h']] = (int) $row['cnt'];
        }

        return $matrix;
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
