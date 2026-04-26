<?php

namespace App\Controller;

use App\Entity\UserFeedback;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[IsGranted('ROLE_USER')]
class FeedbackController extends AbstractController
{
    #[Route('/feedback', name: 'feedback_submit', methods: ['POST'])]
    public function submit(Request $request, EntityManagerInterface $em): Response
    {
        if (!$this->isCsrfTokenValid('feedback', $request->request->get('_token'))) {
            $this->addFlash('danger', 'Token invalide.');
            return $this->redirectToRoute('app_dashboard');
        }

        $sujet   = trim($request->request->get('sujet', ''));
        $contenu = trim($request->request->get('contenu', ''));

        if ($sujet === '' || $contenu === '') {
            $this->addFlash('warning', 'Le sujet et le message sont obligatoires.');
            return $this->redirectToRoute('app_dashboard');
        }

        $user = $this->getUser();

        $feedback = (new UserFeedback())
            ->setUser($user)
            ->setUserLabel($user->getFullName() . ' <' . $user->getEmail() . '>')
            ->setSujet(substr($sujet, 0, 150))
            ->setContenu(substr($contenu, 0, 5000));

        $em->persist($feedback);
        $em->flush();

        $this->addFlash('success', 'Merci pour votre retour ! Nous l\'examinerons prochainement.');
        return $this->redirectToRoute('app_dashboard');
    }
}
