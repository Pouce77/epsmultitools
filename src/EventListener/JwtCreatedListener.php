<?php

namespace App\EventListener;

use App\Entity\User;
use Lexik\Bundle\JWTAuthenticationBundle\Event\AuthenticationSuccessEvent;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;

#[AsEventListener(event: 'lexik_jwt_authentication.on_authentication_success')]
class JwtCreatedListener
{
    public function __invoke(AuthenticationSuccessEvent $event): void
    {
        $user = $event->getUser();
        if (!$user instanceof User) return;

        $data = $event->getData();
        $data['user'] = [
            'id'     => $user->getId(),
            'email'  => $user->getEmail(),
            'prenom' => $user->getPrenom(),
            'nom'    => $user->getNom(),
        ];
        $event->setData($data);
    }
}
