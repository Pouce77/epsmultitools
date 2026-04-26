<?php

namespace App\Controller;

use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

class NewsletterController extends AbstractController
{
    #[Route('/newsletter/unsubscribe/{id}/{token}', name: 'newsletter_unsubscribe')]
    public function unsubscribe(int $id, string $token, UserRepository $userRepo, EntityManagerInterface $em): Response
    {
        $user = $userRepo->find($id);

        if (!$user || !hash_equals($this->buildToken($user->getId(), $user->getEmail()), $token)) {
            return $this->render('newsletter/unsubscribe.html.twig', ['success' => false]);
        }

        if (!$user->isNewsletterOptOut()) {
            $user->setNewsletterOptOut(true);
            $em->flush();
        }

        return $this->render('newsletter/unsubscribe.html.twig', ['success' => true]);
    }

    public static function buildToken(int $userId, string $email): string
    {
        return substr(hash_hmac('sha256', $userId . ':' . $email, $_ENV['APP_SECRET'] ?? 'secret'), 0, 32);
    }
}
