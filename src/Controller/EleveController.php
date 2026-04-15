<?php

namespace App\Controller;

use App\Entity\Eleve;
use App\Form\EleveType;
use App\Repository\ClasseRepository;
use App\Repository\EleveRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[IsGranted('ROLE_USER')]
#[Route('/classes/{classeId}/eleves')]
class EleveController extends AbstractController
{
    #[Route('/new', name: 'app_eleve_new', methods: ['GET', 'POST'])]
    public function new(int $classeId, Request $request, ClasseRepository $classeRepository, EntityManagerInterface $em): Response
    {
        $classe = $this->getClasseOrDeny($classeId, $classeRepository);

        $eleve = new Eleve();
        $eleve->setClasse($classe);
        $form = $this->createForm(EleveType::class, $eleve);
        $form->handleRequest($request);

        if ($form->isSubmitted() && $form->isValid()) {
            $em->persist($eleve);
            $em->flush();
            $this->addFlash('success', $eleve->getFullName() . ' ajouté(e).');
            return $this->redirectToRoute('app_classe_show', ['id' => $classeId]);
        }

        return $this->render('eleve/new.html.twig', ['form' => $form, 'classe' => $classe]);
    }

    #[Route('/{id}/edit', name: 'app_eleve_edit', methods: ['GET', 'POST'])]
    public function edit(int $classeId, int $id, Request $request, ClasseRepository $classeRepository, EleveRepository $eleveRepository, EntityManagerInterface $em): Response
    {
        $classe = $this->getClasseOrDeny($classeId, $classeRepository);
        $eleve = $this->getEleveOrDeny($id, $classe, $eleveRepository);

        $form = $this->createForm(EleveType::class, $eleve);
        $form->handleRequest($request);

        if ($form->isSubmitted() && $form->isValid()) {
            $em->flush();
            $this->addFlash('success', $eleve->getFullName() . ' modifié(e).');
            return $this->redirectToRoute('app_classe_show', ['id' => $classeId]);
        }

        return $this->render('eleve/edit.html.twig', ['form' => $form, 'eleve' => $eleve, 'classe' => $classe]);
    }

    #[Route('/{id}/delete', name: 'app_eleve_delete', methods: ['POST'])]
    public function delete(int $classeId, int $id, Request $request, ClasseRepository $classeRepository, EleveRepository $eleveRepository, EntityManagerInterface $em): Response
    {
        $classe = $this->getClasseOrDeny($classeId, $classeRepository);
        $eleve = $this->getEleveOrDeny($id, $classe, $eleveRepository);

        if ($this->isCsrfTokenValid('delete-eleve-' . $eleve->getId(), $request->request->get('_token'))) {
            $em->remove($eleve);
            $em->flush();
            $this->addFlash('success', $eleve->getFullName() . ' supprimé(e).');
        }

        return $this->redirectToRoute('app_classe_show', ['id' => $classeId]);
    }

    #[Route('/{id}/vma', name: 'app_eleve_vma', methods: ['PATCH'])]
    public function updateVma(
        int $classeId,
        int $id,
        Request $request,
        ClasseRepository $classeRepository,
        EleveRepository $eleveRepository,
        EntityManagerInterface $em,
    ): JsonResponse {
        $classe = $this->getClasseOrDeny($classeId, $classeRepository);
        $eleve  = $this->getEleveOrDeny($id, $classe, $eleveRepository);

        $body = json_decode($request->getContent(), true);
        $vma  = isset($body['vma']) && is_numeric($body['vma']) ? (float) $body['vma'] : null;

        $eleve->setVma($vma);
        $em->flush();

        return $this->json(['vma' => $eleve->getVma()]);
    }

    private function getClasseOrDeny(int $id, ClasseRepository $classeRepository): \App\Entity\Classe
    {
        $classe = $classeRepository->findOneByIdAndEnseignant($id, $this->getUser());
        if (!$classe) {
            throw $this->createNotFoundException('Classe introuvable.');
        }
        return $classe;
    }

    private function getEleveOrDeny(int $id, \App\Entity\Classe $classe, EleveRepository $eleveRepository): Eleve
    {
        $eleve = $eleveRepository->find($id);
        if (!$eleve || $eleve->getClasse() !== $classe) {
            throw $this->createNotFoundException('Élève introuvable.');
        }
        return $eleve;
    }
}
