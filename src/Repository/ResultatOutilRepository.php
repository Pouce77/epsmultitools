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

    /** Distinct active users per month for the last N months. */
    public function activeUsersParMois(int $mois = 6): array
    {
        return $this->getEntityManager()->getConnection()->fetchAllAssociative(
            'SELECT SUBSTRING(created_at, 1, 7) AS mois, COUNT(DISTINCT enseignant_id) AS nb
             FROM resultat_outil
             WHERE created_at >= ?
             GROUP BY mois ORDER BY mois ASC',
            [(new \DateTimeImmutable("-$mois months"))->format('Y-m-d')]
        );
    }

    /** Per-tool counts: total, this month, previous month. */
    public function countByOutilWithTrend(): array
    {
        return $this->getEntityManager()->getConnection()->fetchAllAssociative(
            "SELECT outil,
                COUNT(*) AS total,
                SUM(CASE WHEN created_at >= DATE_FORMAT(NOW(),'%Y-%m-01') THEN 1 ELSE 0 END) AS ce_mois,
                SUM(CASE WHEN created_at >= DATE_FORMAT(DATE_SUB(NOW(),INTERVAL 1 MONTH),'%Y-%m-01')
                          AND created_at <  DATE_FORMAT(NOW(),'%Y-%m-01') THEN 1 ELSE 0 END) AS mois_prec
             FROM resultat_outil GROUP BY outil ORDER BY total DESC"
        );
    }

    /** Detailed per-tool stats: users, avg usage, last use, this month. */
    public function getOutilsDetailedStats(): array
    {
        return $this->getEntityManager()->getConnection()->fetchAllAssociative(
            "SELECT outil,
                COUNT(*) AS total,
                COUNT(DISTINCT enseignant_id) AS nb_utilisateurs,
                ROUND(COUNT(*) / NULLIF(COUNT(DISTINCT enseignant_id), 0), 1) AS moy_par_utilisateur,
                MAX(created_at) AS derniere_utilisation,
                SUM(CASE WHEN created_at >= DATE_FORMAT(NOW(),'%Y-%m-01') THEN 1 ELSE 0 END) AS ce_mois
             FROM resultat_outil
             GROUP BY outil
             ORDER BY total DESC"
        );
    }

    /** Top establishments ranked by number of saved results. */
    public function topEtablissementsActifs(int $limit = 10): array
    {
        return $this->getEntityManager()->getConnection()->fetchAllAssociative(
            'SELECT u.etablissement, COUNT(r.id) AS nb_resultats, COUNT(DISTINCT r.enseignant_id) AS nb_users
             FROM resultat_outil r
             JOIN `user` u ON u.id = r.enseignant_id
             WHERE u.etablissement IS NOT NULL AND u.etablissement <> \'\'
             GROUP BY u.etablissement
             ORDER BY nb_resultats DESC
             LIMIT ' . (int) $limit
        );
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
