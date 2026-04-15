<?php

namespace App\Controller;

use App\Repository\ClasseRepository;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[IsGranted('ROLE_USER')]
class DashboardController extends AbstractController
{
    #[Route('/dashboard', name: 'app_dashboard')]
    public function index(ClasseRepository $classeRepository): Response
    {
        $classes = $classeRepository->findByEnseignant($this->getUser());

        return $this->render('dashboard/index.html.twig', [
            'classes' => $classes,
        ]);
    }
}
