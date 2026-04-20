<?php

namespace App\Controller;

use App\Repository\ClasseRepository;
use App\Repository\EleveRepository;
use App\Repository\ResultatOutilRepository;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api', name: 'api_')]
class ApiController extends AbstractController
{
    /**
     * GET /api/data
     * Retourne toutes les classes + élèves + résultats de l'enseignant connecté.
     */
    #[Route('/data', name: 'data', methods: ['GET'])]
    public function data(
        ClasseRepository $classeRepo,
        ResultatOutilRepository $resultatRepo,
    ): JsonResponse {
        /** @var \App\Entity\User $user */
        $user = $this->getUser();

        $classes = $classeRepo->findBy(['enseignant' => $user], ['nom' => 'ASC']);
        $resultats = $resultatRepo->findBy(['enseignant' => $user], ['createdAt' => 'DESC'], 200);

        $classesData = array_map(function ($classe) {
            return [
                'id'            => $classe->getId(),
                'nom'           => $classe->getNom(),
                'niveau'        => $classe->getNiveau(),
                'annee_scolaire' => $classe->getAnneeScolaire(),
                'eleves'        => array_map(fn ($e) => [
                    'id'     => $e->getId(),
                    'prenom' => $e->getPrenom(),
                    'nom'    => $e->getNom(),
                    'genre'  => $e->getSexe(),
                    'niveau' => $e->getNiveau() ?? 3,
                    'vma'    => $e->getVma(),
                ], $classe->getEleves()->toArray()),
            ];
        }, $classes);

        $resultatsData = array_map(fn ($r) => [
            'id'         => $r->getId(),
            'outil'      => $r->getOutil(),
            'label'      => $r->getLabel(),
            'classe_id'  => $r->getClasse()->getId(),
            'data'       => $r->getData(),
            'created_at' => $r->getCreatedAt()->format(\DateTimeInterface::ATOM),
        ], $resultats);

        return $this->json([
            'classes'   => $classesData,
            'resultats' => $resultatsData,
        ]);
    }

    /**
     * PATCH /api/eleves/{id}
     * Met à jour nom, prenom, sexe, niveau d'un élève appartenant à l'enseignant connecté.
     */
    #[Route('/eleves/{id}', name: 'eleve_update', methods: ['PATCH'])]
    public function updateEleve(
        int $id,
        Request $request,
        EleveRepository $eleveRepo,
    ): JsonResponse {
        /** @var \App\Entity\User $user */
        $user  = $this->getUser();
        $eleve = $eleveRepo->find($id);

        if (!$eleve || $eleve->getClasse()->getEnseignant() !== $user) {
            return $this->json(['error' => 'Élève introuvable.'], 404);
        }

        $body = json_decode($request->getContent(), true) ?? [];

        if (isset($body['nom']) && trim($body['nom']) !== '') {
            $eleve->setNom(trim($body['nom']));
        }
        if (isset($body['prenom']) && trim($body['prenom']) !== '') {
            $eleve->setPrenom(trim($body['prenom']));
        }
        if (array_key_exists('sexe', $body) && in_array($body['sexe'], ['M', 'F'], true)) {
            $eleve->setSexe($body['sexe']);
        }
        if (array_key_exists('niveau', $body) && is_int($body['niveau']) && $body['niveau'] >= 1 && $body['niveau'] <= 5) {
            $eleve->setNiveau($body['niveau']);
        }

        $eleveRepo->getEntityManager()->flush();

        return $this->json([
            'id'     => $eleve->getId(),
            'prenom' => $eleve->getPrenom(),
            'nom'    => $eleve->getNom(),
            'genre'  => $eleve->getSexe(),
            'niveau' => $eleve->getNiveau() ?? 3,
            'vma'    => $eleve->getVma(),
        ]);
    }

}
