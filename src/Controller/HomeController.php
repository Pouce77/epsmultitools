<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;
use Symfony\Component\Routing\Attribute\Route;

class HomeController extends AbstractController
{
    #[Route('/', name: 'app_home')]
    public function index(): Response
    {
        if ($this->getUser()) {
            return $this->redirectToRoute('app_dashboard');
        }

        return $this->render('home/index.html.twig');
    }

    #[Route('/mentions-legales', name: 'app_mentions_legales')]
    public function mentionsLegales(): Response
    {
        return $this->render('home/mentions-legales.html.twig');
    }

    #[Route('/confidentialite', name: 'app_confidentialite')]
    public function confidentialite(): Response
    {
        return $this->render('home/confidentialite.html.twig');
    }

    #[Route('/contact', name: 'app_contact', methods: ['GET', 'POST'])]
    public function contact(
        Request $request,
        MailerInterface $mailer,
        #[Autowire('%env(CONTACT_EMAIL)%')] string $contactEmail,
    ): Response {
        $error  = null;
        $fields = ['nom' => '', 'email' => '', 'sujet' => '', 'message' => ''];

        if ($request->isMethod('POST')) {
            if (!$this->isCsrfTokenValid('contact', $request->request->get('_token'))) {
                $error = 'Token de sécurité invalide. Veuillez réessayer.';
            } else {
                foreach (array_keys($fields) as $key) {
                    $fields[$key] = trim((string) $request->request->get($key, ''));
                }

                if (array_filter($fields) !== $fields) {
                    $error = 'Tous les champs obligatoires doivent être remplis.';
                } elseif (!filter_var($fields['email'], FILTER_VALIDATE_EMAIL)) {
                    $error = 'Adresse e-mail invalide.';
                } elseif (!$request->request->get('rgpd')) {
                    $error = 'Vous devez accepter l\'utilisation de vos données pour répondre à votre demande.';
                } else {
                    try {
                        $body = sprintf(
                            '<p><strong>De :</strong> %s (<a href="mailto:%s">%s</a>)</p>
                             <p><strong>Sujet :</strong> %s</p>
                             <hr>
                             <p>%s</p>',
                            htmlspecialchars($fields['nom']),
                            htmlspecialchars($fields['email']),
                            htmlspecialchars($fields['email']),
                            htmlspecialchars($fields['sujet']),
                            nl2br(htmlspecialchars($fields['message']))
                        );

                        $mail = (new Email())
                            ->from(new Address($contactEmail, 'EPS Multi-Tools'))
                            ->to($contactEmail)
                            ->replyTo(new Address($fields['email'], $fields['nom']))
                            ->subject('[EPS Multi-Tools] ' . $fields['sujet'])
                            ->html($body);

                        $mailer->send($mail);

                        $this->addFlash('success', 'Votre message a bien été envoyé. Nous vous répondrons dans les meilleurs délais.');

                        return $this->redirectToRoute('app_contact');
                    } catch (\Throwable) {
                        $error = 'Une erreur est survenue lors de l\'envoi. Veuillez réessayer plus tard.';
                    }
                }
            }
        }

        return $this->render('home/contact.html.twig', [
            'error'  => $error,
            'fields' => $fields,
        ]);
    }
}
