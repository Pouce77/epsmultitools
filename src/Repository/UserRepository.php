<?php

namespace App\Repository;

use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Security\Core\Exception\UnsupportedUserException;
use Symfony\Component\Security\Core\User\PasswordAuthenticatedUserInterface;
use Symfony\Component\Security\Core\User\PasswordUpgraderInterface;

/**
 * @extends ServiceEntityRepository<User>
 */
class UserRepository extends ServiceEntityRepository implements PasswordUpgraderInterface
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, User::class);
    }

    public function upgradePassword(PasswordAuthenticatedUserInterface $user, string $newHashedPassword): void
    {
        if (!$user instanceof User) {
            throw new UnsupportedUserException(sprintf('Instances of "%s" are not supported.', $user::class));
        }
        $user->setPassword($newHashedPassword);
        $this->getEntityManager()->persist($user);
        $this->getEntityManager()->flush();
    }

    public function countTotal(): int
    {
        return $this->count([]);
    }

    public function countThisMonth(): int
    {
        return (int) $this->createQueryBuilder('u')
            ->select('COUNT(u.id)')
            ->where('u.createdAt >= :start')
            ->setParameter('start', new \DateTimeImmutable('first day of this month 00:00:00'))
            ->getQuery()->getSingleScalarResult();
    }

    public function inscriptionsParMois(int $mois = 6): array
    {
        $rows = $this->createQueryBuilder('u')
            ->select("SUBSTRING(u.createdAt, 1, 7) AS mois, COUNT(u.id) AS nb")
            ->where('u.createdAt >= :since')
            ->setParameter('since', new \DateTimeImmutable("-$mois months"))
            ->groupBy('mois')
            ->orderBy('mois', 'ASC')
            ->getQuery()->getResult();

        return $rows;
    }

    /** @return User[] */
    public function findAllOrderedByDate(): array
    {
        return $this->createQueryBuilder('u')
            ->orderBy('u.createdAt', 'DESC')
            ->getQuery()->getResult();
    }

    /** Filtered + paginated user list. Returns ['users', 'total', 'pages']. */
    public function findFiltered(string $q, string $role, int $page, int $perPage = 25): array
    {
        $qb = $this->createQueryBuilder('u');

        if ($q !== '') {
            $qb->andWhere('u.nom LIKE :q OR u.prenom LIKE :q OR u.email LIKE :q OR u.etablissement LIKE :q')
               ->setParameter('q', '%' . $q . '%');
        }
        if ($role === 'admin') {
            $qb->andWhere('u.roles LIKE :admin')->setParameter('admin', '%ROLE_ADMIN%');
        } elseif ($role === 'user') {
            $qb->andWhere('u.roles NOT LIKE :admin')->setParameter('admin', '%ROLE_ADMIN%');
        }

        $total = (int) (clone $qb)->select('COUNT(u.id)')->getQuery()->getSingleScalarResult();

        $users = $qb
            ->orderBy('u.createdAt', 'DESC')
            ->setFirstResult(($page - 1) * $perPage)
            ->setMaxResults($perPage)
            ->getQuery()->getResult();

        return ['users' => $users, 'total' => $total, 'pages' => (int) ceil($total / $perPage)];
    }

    /** Returns [userId => 'Y-m-d H:i:s'] for last ResultatOutil per user. */
    public function lastActivitiesMap(): array
    {
        $rows = $this->getEntityManager()->getConnection()->fetchAllAssociative(
            'SELECT enseignant_id, MAX(created_at) AS last_at FROM resultat_outil GROUP BY enseignant_id'
        );
        $map = [];
        foreach ($rows as $row) {
            $map[(int) $row['enseignant_id']] = $row['last_at'];
        }
        return $map;
    }

    public function statsParEtablissement(): array
    {
        return $this->createQueryBuilder('u')
            ->select('u.etablissement AS etablissement, COUNT(u.id) AS nb')
            ->where('u.etablissement IS NOT NULL')
            ->groupBy('u.etablissement')
            ->orderBy('nb', 'DESC')
            ->setMaxResults(10)
            ->getQuery()->getResult();
    }

    /** @return User[] */
    public function findInactifs(int $joursInactivite = 90): array
    {
        $since = new \DateTimeImmutable("-$joursInactivite days");
        return $this->createQueryBuilder('u')
            ->leftJoin('App\Entity\ResultatOutil', 'r', 'WITH', 'r.enseignant = u AND r.createdAt >= :since')
            ->where('r.id IS NULL')
            ->andWhere('u.createdAt < :since')
            ->setParameter('since', $since)
            ->orderBy('u.createdAt', 'ASC')
            ->getQuery()->getResult();
    }

    /** @return User[] Never saved any result. */
    public function findJamaisActifs(): array
    {
        return $this->createQueryBuilder('u')
            ->leftJoin('App\Entity\ResultatOutil', 'r', 'WITH', 'r.enseignant = u')
            ->where('r.id IS NULL')
            ->orderBy('u.createdAt', 'DESC')
            ->getQuery()->getResult();
    }

    /** Conversion funnel: registered → class → result. */
    public function getConversionStats(): array
    {
        $conn = $this->getEntityManager()->getConnection();
        return [
            'inscrits'  => (int) $conn->fetchOne('SELECT COUNT(*) FROM `user`'),
            'classes'   => (int) $conn->fetchOne('SELECT COUNT(DISTINCT enseignant_id) FROM classe'),
            'resultats' => (int) $conn->fetchOne('SELECT COUNT(DISTINCT enseignant_id) FROM resultat_outil'),
        ];
    }

    /** Users sharing the same last name within the same établissement. */
    public function findDoublons(): array
    {
        return $this->getEntityManager()->getConnection()->fetchAllAssociative(
            "SELECT etablissement, nom, COUNT(*) AS nb,
                    GROUP_CONCAT(CONCAT(prenom, ' (', email, ')') ORDER BY prenom SEPARATOR ' · ') AS membres
             FROM `user`
             WHERE etablissement IS NOT NULL AND etablissement <> ''
             GROUP BY etablissement, LOWER(nom)
             HAVING nb > 1
             ORDER BY etablissement, nom"
        );
    }

    /** @return User[] Inactive 6+ months, warning not yet sent. */
    public function findAavertir(): array
    {
        $since = new \DateTimeImmutable('-6 months');
        return $this->createQueryBuilder('u')
            ->leftJoin('App\Entity\ResultatOutil', 'r', 'WITH', 'r.enseignant = u AND r.createdAt >= :since')
            ->where('r.id IS NULL')
            ->andWhere('u.createdAt < :since')
            ->andWhere('u.warningEmailSentAt IS NULL')
            ->setParameter('since', $since)
            ->orderBy('u.createdAt', 'ASC')
            ->getQuery()->getResult();
    }

    /** @return User[] Warning sent 30+ days ago and still inactive. */
    public function findASupprimer(): array
    {
        $since6  = new \DateTimeImmutable('-6 months');
        $cutoff  = new \DateTimeImmutable('-30 days');
        return $this->createQueryBuilder('u')
            ->leftJoin('App\Entity\ResultatOutil', 'r', 'WITH', 'r.enseignant = u AND r.createdAt >= :since6')
            ->where('r.id IS NULL')
            ->andWhere('u.warningEmailSentAt IS NOT NULL')
            ->andWhere('u.warningEmailSentAt < :cutoff')
            ->setParameter('since6', $since6)
            ->setParameter('cutoff', $cutoff)
            ->orderBy('u.warningEmailSentAt', 'ASC')
            ->getQuery()->getResult();
    }
}
