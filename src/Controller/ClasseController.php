<?php

namespace App\Controller;

use App\Entity\Classe;
use App\Form\ClasseType;
use App\Form\ImportElevesType;
use App\Repository\ClasseRepository;
use App\Service\ImportElevesService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[IsGranted('ROLE_USER')]
#[Route('/classes')]
class ClasseController extends AbstractController
{
    #[Route('', name: 'app_classe_index')]
    public function index(ClasseRepository $classeRepository): Response
    {
        return $this->render('classe/index.html.twig', [
            'classes' => $classeRepository->findByEnseignant($this->getUser()),
        ]);
    }

    #[Route('/new', name: 'app_classe_new', methods: ['GET', 'POST'])]
    public function new(Request $request, EntityManagerInterface $em): Response
    {
        $classe = new Classe();
        $form = $this->createForm(ClasseType::class, $classe);
        $form->handleRequest($request);

        if ($form->isSubmitted() && $form->isValid()) {
            $classe->setEnseignant($this->getUser());
            $em->persist($classe);
            $em->flush();
            $this->addFlash('success', 'Classe « ' . $classe->getNom() . ' » créée avec succès.');
            return $this->redirectToRoute('app_classe_show', ['id' => $classe->getId()]);
        }

        return $this->render('classe/new.html.twig', ['form' => $form]);
    }

    #[Route('/{id}', name: 'app_classe_show', methods: ['GET'])]
    public function show(int $id, ClasseRepository $classeRepository): Response
    {
        $classe = $this->getClasseOrDeny($id, $classeRepository);

        return $this->render('classe/show.html.twig', ['classe' => $classe]);
    }

    #[Route('/{id}/edit', name: 'app_classe_edit', methods: ['GET', 'POST'])]
    public function edit(int $id, Request $request, ClasseRepository $classeRepository, EntityManagerInterface $em): Response
    {
        $classe = $this->getClasseOrDeny($id, $classeRepository);
        $form = $this->createForm(ClasseType::class, $classe);
        $form->handleRequest($request);

        if ($form->isSubmitted() && $form->isValid()) {
            $em->flush();
            $this->addFlash('success', 'Classe modifiée avec succès.');
            return $this->redirectToRoute('app_classe_show', ['id' => $classe->getId()]);
        }

        return $this->render('classe/edit.html.twig', ['form' => $form, 'classe' => $classe]);
    }

    #[Route('/{id}/delete', name: 'app_classe_delete', methods: ['POST'])]
    public function delete(int $id, Request $request, ClasseRepository $classeRepository, EntityManagerInterface $em): Response
    {
        $classe = $this->getClasseOrDeny($id, $classeRepository);

        if ($this->isCsrfTokenValid('delete-classe-' . $classe->getId(), $request->request->get('_token'))) {
            $em->remove($classe);
            $em->flush();
            $this->addFlash('success', 'Classe supprimée.');
        }

        return $this->redirectToRoute('app_classe_index');
    }

    #[Route('/{id}/import', name: 'app_classe_import', methods: ['GET', 'POST'])]
    public function import(
        int $id,
        Request $request,
        ClasseRepository $classeRepository,
        ImportElevesService $importService,
        EntityManagerInterface $em,
    ): Response {
        $classe = $this->getClasseOrDeny($id, $classeRepository);

        $form = $this->createForm(ImportElevesType::class);
        $form->handleRequest($request);

        $preview = null;

        if ($form->isSubmitted() && $form->isValid()) {
            $data = $form->getData();
            $eleves = $importService->parse($data['contenu'], $data['format'], $classe);
            //if ($request->request->has('confirm')) {
                foreach ($eleves as $eleve) {
                    $em->persist($eleve);
                }
                $em->flush();
                $this->addFlash('success', count($eleves) . ' élève(s) importé(s) avec succès.');
                return $this->redirectToRoute('app_classe_show', ['id' => $classe->getId()]);
            //}

            $preview = $eleves;
        }

        return $this->render('classe/import.html.twig', [
            'form' => $form,
            'classe' => $classe,
            'preview' => $preview,
        ]);
    }

    private function getClasseOrDeny(int $id, ClasseRepository $classeRepository): Classe
    {
        $classe = $classeRepository->findOneByIdAndEnseignant($id, $this->getUser());
        if (!$classe) {
            throw $this->createNotFoundException('Classe introuvable.');
        }
        return $classe;
    }
}
