<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

class SitemapController extends AbstractController
{
    #[Route('/sitemap.xml', name: 'sitemap', defaults: ['_format' => 'xml'])]
    public function index(): Response
    {
        $urls = [
            ['loc' => $this->generateUrl('app_home', [], \Symfony\Component\Routing\Generator\UrlGeneratorInterface::ABSOLUTE_URL), 'priority' => '1.0', 'changefreq' => 'weekly'],
            ['loc' => $this->generateUrl('app_register', [], \Symfony\Component\Routing\Generator\UrlGeneratorInterface::ABSOLUTE_URL), 'priority' => '0.8', 'changefreq' => 'monthly'],
            ['loc' => $this->generateUrl('app_login', [], \Symfony\Component\Routing\Generator\UrlGeneratorInterface::ABSOLUTE_URL), 'priority' => '0.7', 'changefreq' => 'monthly'],
            ['loc' => $this->generateUrl('app_contact', [], \Symfony\Component\Routing\Generator\UrlGeneratorInterface::ABSOLUTE_URL), 'priority' => '0.5', 'changefreq' => 'monthly'],
            ['loc' => $this->generateUrl('app_mentions_legales', [], \Symfony\Component\Routing\Generator\UrlGeneratorInterface::ABSOLUTE_URL), 'priority' => '0.2', 'changefreq' => 'yearly'],
            ['loc' => $this->generateUrl('app_confidentialite', [], \Symfony\Component\Routing\Generator\UrlGeneratorInterface::ABSOLUTE_URL), 'priority' => '0.2', 'changefreq' => 'yearly'],
        ];

        $response = new Response(
            $this->renderView('sitemap.xml.twig', ['urls' => $urls]),
            Response::HTTP_OK,
            ['Content-Type' => 'application/xml']
        );

        $response->setMaxAge(86400); // cache 24h
        return $response;
    }
}
