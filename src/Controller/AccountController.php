<?php

namespace App\Controller;

use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

class AccountController extends AbstractController
{
    #[Route('/compte/supprimer/{id}/{token}', name: 'account_delete')]
    public function delete(
        int $id,
        string $token,
        UserRepository $userRepo,
        EntityManagerInterface $em,
        Request $request,
    ): Response {
        $user  = $userRepo->find($id);
        $valid = $user && hash_equals(self::buildDeletionToken($user->getId(), $user->getEmail()), $token);

        if (!$valid) {
            return $this->render('account/supprimer.html.twig', ['valid' => false, 'deleted' => false]);
        }

        if ($request->isMethod('POST') && $this->isCsrfTokenValid('delete-account-' . $id, $request->request->get('_token'))) {
            $em->remove($user);
            $em->flush();
            return $this->render('account/supprimer.html.twig', ['valid' => true, 'deleted' => true]);
        }

        return $this->render('account/supprimer.html.twig', [
            'valid'   => true,
            'deleted' => false,
            'user'    => $user,
            'token'   => $token,
        ]);
    }

    public static function buildDeletionToken(int $userId, string $email): string
    {
        return substr(hash_hmac('sha256', 'delete:' . $userId . ':' . $email, $_ENV['APP_SECRET'] ?? 'secret'), 0, 32);
    }
}
