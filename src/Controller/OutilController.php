<?php

namespace App\Controller;

use App\Repository\ClasseRepository;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[IsGranted('ROLE_USER')]
#[Route('/outils')]
class OutilController extends AbstractController
{
    #[Route('/{classeId}/vitesse', name: 'app_outil_vitesse')]
    public function vitesse(int $classeId, ClasseRepository $classeRepository): Response
    {
        $classe = $this->getClasseOrDeny($classeId, $classeRepository);
        return $this->render('outils/vitesse.html.twig', $this->buildContext($classe));
    }

    #[Route('/{classeId}/scores', name: 'app_outil_scores')]
    public function scores(int $classeId, ClasseRepository $classeRepository): Response
    {
        $classe = $this->getClasseOrDeny($classeId, $classeRepository);
        return $this->render('outils/scores.html.twig', $this->buildContext($classe));
    }

    #[Route('/{classeId}/actions', name: 'app_outil_actions')]
    public function actions(int $classeId, ClasseRepository $classeRepository): Response
    {
        $classe = $this->getClasseOrDeny($classeId, $classeRepository);
        return $this->render('outils/actions.html.twig', $this->buildContext($classe));
    }

    #[Route('/{classeId}/tournoi', name: 'app_outil_tournoi')]
    public function tournoi(int $classeId, ClasseRepository $classeRepository): Response
    {
        $classe = $this->getClasseOrDeny($classeId, $classeRepository);
        return $this->render('outils/tournoi.html.twig', $this->buildContext($classe));
    }

    #[Route('/{classeId}/equipes', name: 'app_outil_equipes')]
    public function equipes(int $classeId, ClasseRepository $classeRepository): Response
    {
        $classe = $this->getClasseOrDeny($classeId, $classeRepository);
        return $this->render('outils/equipes.html.twig', $this->buildContext($classe));
    }

    #[Route('/{classeId}/impacts', name: 'app_outil_impacts')]
    public function impacts(int $classeId, ClasseRepository $classeRepository): Response
    {
        $classe = $this->getClasseOrDeny($classeId, $classeRepository);
        return $this->render('outils/impacts.html.twig', $this->buildContext($classe));
    }

    private function buildContext(\App\Entity\Classe $classe): array
    {
        $elevesData = array_values(array_map(fn($e) => [
            'id'       => $e->getId(),
            'nom'      => $e->getNom(),
            'prenom'   => $e->getPrenom(),
            'sexe'     => $e->getSexe(),
            'fullName' => $e->getFullName(),
            'niveau'   => $e->getNiveau(),
            'vma'      => $e->getVma(),
        ], $classe->getEleves()->toArray()));

        return [
            'classe' => $classe,
            'elevesJson' => json_encode($elevesData, JSON_UNESCAPED_UNICODE),
        ];
    }

    private function getClasseOrDeny(int $id, ClasseRepository $classeRepository): \App\Entity\Classe
    {
        $classe = $classeRepository->findOneByIdAndEnseignant($id, $this->getUser());
        if (!$classe) {
            throw $this->createNotFoundException('Classe introuvable.');
        }
        return $classe;
    }
}
