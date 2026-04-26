<?php

namespace App\Service;

use App\Entity\AdminLog;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;

class AdminLogger
{
    public function __construct(private EntityManagerInterface $em) {}

    public function log(User $admin, string $action, ?User $target = null, ?string $details = null): void
    {
        $log = (new AdminLog())
            ->setAction($action)
            ->setAdmin($admin)
            ->setAdminLabel($admin->getFullName() . ' <' . $admin->getEmail() . '>')
            ->setTargetUser($target)
            ->setTargetUserLabel($target ? $target->getFullName() . ' <' . $target->getEmail() . '>' : null)
            ->setDetails($details);

        $this->em->persist($log);
        $this->em->flush();
    }
}
