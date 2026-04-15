<?php

namespace App\Controller;

use App\Entity\ResultatOutil;
use App\Form\ProfileFormType;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[IsGranted('ROLE_USER')]
#[Route('/profile')]
class ProfileController extends AbstractController
{
    #[Route('', name: 'app_profile', methods: ['GET'])]
    public function show(EntityManagerInterface $em): Response
    {
        /** @var \App\Entity\User $user */
        $user = $this->getUser();
        $form = $this->createForm(ProfileFormType::class, $user);

        return $this->render('profile/index.html.twig', [
            'profileForm' => $form->createView(),
            'user'        => $user,
            'stats'       => $this->buildStats($user, $em),
        ]);
    }

    #[Route('/edit', name: 'app_profile_edit', methods: ['POST'])]
    public function edit(
        Request $request,
        EntityManagerInterface $em,
        UserPasswordHasherInterface $hasher,
    ): Response {
        /** @var \App\Entity\User $user */
        $user = $this->getUser();
        $form = $this->createForm(ProfileFormType::class, $user);
        $form->handleRequest($request);

        if ($form->isSubmitted() && $form->isValid()) {
            $newPwd = $form->get('newPassword')->getData();
            if ($newPwd) {
                $user->setPassword($hasher->hashPassword($user, $newPwd));
            }
            $em->flush();
            $this->addFlash('success', 'Votre profil a été mis à jour.');

            return $this->redirectToRoute('app_profile');
        }

        return $this->render('profile/index.html.twig', [
            'profileForm' => $form->createView(),
            'user'        => $user,
            'stats'       => $this->buildStats($user, $em),
        ]);
    }

    #[Route('/delete', name: 'app_profile_delete', methods: ['POST'])]
    public function deleteAccount(
        Request $request,
        EntityManagerInterface $em,
        TokenStorageInterface $tokenStorage,
    ): Response {
        if (!$this->isCsrfTokenValid('delete-account', $request->request->get('_token'))) {
            throw $this->createAccessDeniedException('Token CSRF invalide.');
        }

        /** @var \App\Entity\User $user */
        $user = $this->getUser();

        // Supprimer les résultats manuellement (FK enseignant sans onDelete cascade)
        $em->createQueryBuilder()
            ->delete(ResultatOutil::class, 'r')
            ->where('r.enseignant = :u')
            ->setParameter('u', $user)
            ->getQuery()
            ->execute();

        // Invalider la session avant de supprimer l'entité
        $tokenStorage->setToken(null);
        $request->getSession()->invalidate();

        // Suppression de l'utilisateur (orphanRemoval cascade classes + élèves)
        $em->remove($user);
        $em->flush();

        return $this->redirectToRoute('app_home');
    }

    private function buildStats(\App\Entity\User $user, EntityManagerInterface $em): array
    {
        $eleves = 0;
        foreach ($user->getClasses() as $classe) {
            $eleves += $classe->getEffectif();
        }

        return [
            'classes'   => $user->getClasses()->count(),
            'eleves'    => $eleves,
            'resultats' => $em->getRepository(ResultatOutil::class)->count(['enseignant' => $user]),
        ];
    }
}
