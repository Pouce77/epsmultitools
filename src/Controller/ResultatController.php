<?php

namespace App\Controller;

use App\Entity\ResultatOutil;
use App\Repository\ClasseRepository;
use App\Repository\ResultatOutilRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[IsGranted('ROLE_USER')]
class ResultatController extends AbstractController
{
    private const OUTILS_VALIDES = ['vitesse', 'actions', 'scores', 'tournoi', 'equipes', 'impacts'];

    // ── Dashboard ──────────────────────────────────────────────────────

    #[Route('/resultats', name: 'app_resultat_index')]
    public function index(
        Request $request,
        ResultatOutilRepository $resultatRepo,
        ClasseRepository $classeRepo,
    ): Response {
        $filters = array_filter([
            'outil'    => $request->query->get('outil'),
            'classeId' => $request->query->get('classeId'),
            'dateFrom' => $request->query->get('dateFrom'),
            'dateTo'   => $request->query->get('dateTo'),
        ]);

        $resultats = $resultatRepo->findByEnseignantFiltered($this->getUser(), $filters);
        $classes   = $classeRepo->findByEnseignant($this->getUser());

        $tournoiDisplays = [];
        foreach ($resultats as $r) {
            if ($r->getOutil() === 'tournoi') {
                $tournoiDisplays[$r->getId()] = $this->computeTournoiDisplay($r->getData());
            }
        }

        return $this->render('resultats/index.html.twig', [
            'resultats'       => $resultats,
            'classes'         => $classes,
            'filters'         => $filters,
            'outils'          => self::OUTILS_VALIDES,
            'tournoiDisplays' => $tournoiDisplays,
        ]);
    }

    // ── API : lister ──────────────────────────────────────────────────

    #[Route('/api/resultats', name: 'api_resultat_list', methods: ['GET'])]
    public function list(
        Request $request,
        ResultatOutilRepository $resultatRepo,
    ): JsonResponse {
        $filters = array_filter([
            'outil'    => $request->query->get('outil'),
            'classeId' => $request->query->get('classeId'),
        ]);

        $resultats = $resultatRepo->findByEnseignantFiltered($this->getUser(), $filters);

        return $this->json(array_map(fn($r) => [
            'id'        => $r->getId(),
            'label'     => $r->getLabel() ?? '(sans nom)',
            'outil'     => $r->getOutil(),
            'createdAt' => $r->getCreatedAt()->format('d/m/Y H:i'),
        ], $resultats));
    }

    // ── API : charger ──────────────────────────────────────────────────

    #[Route('/api/resultats/{id}', name: 'api_resultat_get', methods: ['GET'])]
    public function get(
        int $id,
        ResultatOutilRepository $resultatRepo,
    ): JsonResponse {
        $resultat = $resultatRepo->find($id);

        if (!$resultat || $resultat->getEnseignant() !== $this->getUser()) {
            return $this->json(['error' => 'Résultat introuvable.'], 404);
        }

        return $this->json([
            'id'    => $resultat->getId(),
            'label' => $resultat->getLabel(),
            'data'  => $resultat->getData(),
        ]);
    }

    // ── API : sauvegarder ──────────────────────────────────────────────

    #[Route('/api/resultats', name: 'api_resultat_save', methods: ['POST'])]
    public function save(
        Request $request,
        EntityManagerInterface $em,
        ClasseRepository $classeRepo,
    ): JsonResponse {
        $body = json_decode($request->getContent(), true);

        if (!$body || !isset($body['outil'], $body['classeId'], $body['data'])) {
            return $this->json(['error' => 'Données invalides.'], 400);
        }

        if (!in_array($body['outil'], self::OUTILS_VALIDES, true)) {
            return $this->json(['error' => 'Outil inconnu.'], 400);
        }

        $classe = $classeRepo->findOneByIdAndEnseignant((int) $body['classeId'], $this->getUser());
        if (!$classe) {
            return $this->json(['error' => 'Classe introuvable.'], 403);
        }

        $resultat = (new ResultatOutil())
            ->setOutil($body['outil'])
            ->setClasse($classe)
            ->setEnseignant($this->getUser())
            ->setData($body['data'])
            ->setLabel($body['label'] ?? null);

        $em->persist($resultat);
        $em->flush();

        return $this->json(['id' => $resultat->getId(), 'message' => 'Résultats sauvegardés.']);
    }

    // ── API : supprimer ────────────────────────────────────────────────

    #[Route('/api/resultats/{id}', name: 'api_resultat_delete', methods: ['DELETE'])]
    public function delete(
        int $id,
        ResultatOutilRepository $resultatRepo,
        EntityManagerInterface $em,
    ): JsonResponse {
        $resultat = $resultatRepo->find($id);

        if (!$resultat || $resultat->getEnseignant() !== $this->getUser()) {
            return $this->json(['error' => 'Résultat introuvable.'], 404);
        }

        $em->remove($resultat);
        $em->flush();

        return $this->json(['message' => 'Résultat supprimé.']);
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private function computeTournoiDisplay(array $data): array
    {
        $mode   = $data['mode']   ?? 'roundrobin';
        $teams  = $data['teams']  ?? [];
        $config = $data['config'] ?? [];

        // ── Défi ──────────────────────────────────────────────────────────
        if ($mode === 'defi') {
            $stats = $data['defiStats'] ?? [];
            $rows  = [];
            foreach ($stats as $name => $s) {
                $rows[] = ['name' => $name] + $s;
            }
            usort($rows, fn($a, $b) => $b['pts'] <=> $a['pts'] ?: $b['g'] <=> $a['g']);
            return ['mode' => 'defi', 'rows' => $rows, 'history' => $data['defiHistory'] ?? []];
        }

        // ── Poules ────────────────────────────────────────────────────────
        if ($mode === 'roundrobin') {
            $winPts  = (int)($config['winPts']  ?? 3);
            $drawPts = (int)($config['drawPts'] ?? 1);
            $lossPts = (int)($config['lossPts'] ?? 0);
            $scores  = $data['rrScores'] ?? [];

            $standings = [];
            foreach ($teams as $t) {
                $standings[$t] = ['name' => $t, 'pts' => 0, 'j' => 0, 'g' => 0, 'n' => 0, 'p' => 0, 'bp' => 0, 'bc' => 0];
            }

            $processed = [];
            foreach ($teams as $t1) {
                foreach ($teams as $t2) {
                    if ($t1 === $t2) continue;
                    $pair    = $t1 . '|' . $t2;
                    $pairRev = $t2 . '|' . $t1;
                    if (in_array($pair, $processed, true) || in_array($pairRev, $processed, true)) continue;

                    $k1 = $t1 . '-' . $t2;
                    $k2 = $t2 . '-' . $t1;
                    if (!isset($scores[$k1], $scores[$k2])) continue;

                    $s1 = (int)$scores[$k1];
                    $s2 = (int)$scores[$k2];

                    $standings[$t1]['j']++; $standings[$t1]['bp'] += $s1; $standings[$t1]['bc'] += $s2;
                    $standings[$t2]['j']++; $standings[$t2]['bp'] += $s2; $standings[$t2]['bc'] += $s1;

                    if ($s1 > $s2) {
                        $standings[$t1]['pts'] += $winPts;  $standings[$t1]['g']++;
                        $standings[$t2]['pts'] += $lossPts; $standings[$t2]['p']++;
                    } elseif ($s2 > $s1) {
                        $standings[$t2]['pts'] += $winPts;  $standings[$t2]['g']++;
                        $standings[$t1]['pts'] += $lossPts; $standings[$t1]['p']++;
                    } else {
                        $standings[$t1]['pts'] += $drawPts; $standings[$t1]['n']++;
                        $standings[$t2]['pts'] += $drawPts; $standings[$t2]['n']++;
                    }
                    $processed[] = $pair;
                }
            }

            $rows = array_values($standings);
            usort($rows, function ($a, $b) {
                if ($b['pts'] !== $a['pts']) return $b['pts'] - $a['pts'];
                $gaA = $a['bp'] - $a['bc'];
                $gaB = $b['bp'] - $b['bc'];
                if ($gaB !== $gaA) return $gaB - $gaA;
                return $b['bp'] - $a['bp'];
            });

            return ['mode' => 'roundrobin', 'rows' => $rows, 'teams' => $teams,
                    'config' => ['winPts' => $winPts, 'drawPts' => $drawPts, 'lossPts' => $lossPts]];
        }

        // ── Élimination ───────────────────────────────────────────────────
        return ['mode' => 'elimination', 'teams' => $teams];
    }
}
