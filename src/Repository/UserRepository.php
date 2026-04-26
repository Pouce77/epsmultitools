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
