<?php

namespace App\Controller;

use App\Controller\AccountController;
use App\Entity\User;
use App\Repository\ClasseRepository;
use App\Repository\ResultatOutilRepository;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Email;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[IsGranted('ROLE_ADMIN')]
#[Route('/admin', name: 'admin_')]
class AdminController extends AbstractController
{
    // ── Dashboard ──────────────────────────────────────────────────────────

    #[Route('', name: 'dashboard')]
    public function dashboard(
        UserRepository $userRepo,
        ClasseRepository $classeRepo,
        ResultatOutilRepository $resultatRepo,
    ): Response {
        $heatmapData = $resultatRepo->getActivityHeatmap();
        $heatmapMax  = max(1, ...array_map(fn($row) => max($row), $heatmapData));

        return $this->render('admin/dashboard.html.twig', [
            'nbUsers'           => $userRepo->countTotal(),
            'nbUsersMonth'      => $userRepo->countThisMonth(),
            'nbClasses'         => $classeRepo->count([]),
            'nbResultats'       => $resultatRepo->countTotal(),
            'outilsStats'       => $resultatRepo->countByOutil(),
            'inscriptionsData'  => $userRepo->inscriptionsParMois(6),
            'statsEtablissement'=> $userRepo->statsParEtablissement(),
            'heatmapData'       => $heatmapData,
            'heatmapMax'        => $heatmapMax,
        ]);
    }

    // ── Users list ─────────────────────────────────────────────────────────

    #[Route('/users', name: 'users')]
    public function users(UserRepository $userRepo): Response
    {
        return $this->render('admin/users.html.twig', [
            'users'      => $userRepo->findAllOrderedByDate(),
            'inactifs'   => $userRepo->findInactifs(90),
            'aAvertir'   => $userRepo->findAavertir(),
            'aSupprimer' => $userRepo->findASupprimer(),
        ]);
    }

    // ── Export CSV ─────────────────────────────────────────────────────────

    #[Route('/users/export-csv', name: 'users_export_csv')]
    public function exportCsv(UserRepository $userRepo): StreamedResponse
    {
        $users = $userRepo->findAllOrderedByDate();

        $response = new StreamedResponse(function () use ($users) {
            $fp = fopen('php://output', 'w');
            fprintf($fp, chr(0xEF).chr(0xBB).chr(0xBF)); // BOM UTF-8 pour Excel
            fputcsv($fp, ['ID', 'Prénom', 'Nom', 'Email', 'Établissement', 'Rôle', 'Inscription'], ';');
            foreach ($users as $user) {
                fputcsv($fp, [
                    $user->getId(),
                    $user->getPrenom(),
                    $user->getNom(),
                    $user->getEmail(),
                    $user->getEtablissement() ?? '',
                    in_array('ROLE_ADMIN', $user->getRoles(), true) ? 'Admin' : 'User',
                    $user->getCreatedAt()->format('d/m/Y H:i'),
                ], ';');
            }
            fclose($fp);
        });

        $response->headers->set('Content-Type', 'text/csv; charset=UTF-8');
        $response->headers->set('Content-Disposition', 'attachment; filename="utilisateurs_' . date('Y-m-d') . '.csv"');

        return $response;
    }

    // ── User detail ───────────────────────────────────────────────────────

    #[Route('/users/{id}', name: 'user_show', requirements: ['id' => '\d+'])]
    public function userShow(User $user, ResultatOutilRepository $resultatRepo): Response
    {
        $resultats = $resultatRepo->findByEnseignant($user);

        $parOutil = [];
        foreach ($resultats as $r) {
            $parOutil[$r->getOutil()] = ($parOutil[$r->getOutil()] ?? 0) + 1;
        }
        arsort($parOutil);

        $nbEleves = 0;
        foreach ($user->getClasses() as $classe) {
            $nbEleves += $classe->getEffectif();
        }

        return $this->render('admin/user_detail.html.twig', [
            'user'             => $user,
            'resultats'        => array_slice($resultats, 0, 25),
            'nbResultats'      => count($resultats),
            'parOutil'         => $parOutil,
            'nbEleves'         => $nbEleves,
            'derniereActivite' => $resultats ? $resultats[0]->getCreatedAt() : null,
        ]);
    }

    // ── Send inactivity warning ────────────────────────────────────────────

    #[Route('/users/{id}/send-warning', name: 'user_send_warning', methods: ['POST'])]
    public function sendWarning(User $user, EntityManagerInterface $em, MailerInterface $mailer): Response
    {
        $token     = AccountController::buildDeletionToken($user->getId(), $user->getEmail());
        $deleteUrl = $this->generateUrl('account_delete', ['id' => $user->getId(), 'token' => $token], UrlGeneratorInterface::ABSOLUTE_URL);
        $loginUrl  = $this->generateUrl('app_login', [], UrlGeneratorInterface::ABSOLUTE_URL);

        $email = (new Email())
            ->from($this->getParameter('app.contact_email'))
            ->to($user->getEmail())
            ->subject('Votre compte EPS Multi-Tools va être supprimé')
            ->html($this->renderView('admin/email/avertissement_inactivite.html.twig', [
                'user'      => $user,
                'deleteUrl' => $deleteUrl,
                'loginUrl'  => $loginUrl,
            ]));

        $mailer->send($email);
        $user->setWarningEmailSentAt(new \DateTimeImmutable());
        $em->flush();

        $this->addFlash('success', 'Avertissement envoyé à ' . $user->getFullName() . '.');
        return $this->redirectToRoute('admin_users');
    }

    // ── Toggle admin role ──────────────────────────────────────────────────

    #[Route('/users/{id}/toggle-admin', name: 'user_toggle_admin', methods: ['POST'])]
    public function toggleAdmin(User $user, EntityManagerInterface $em): Response
    {
        if ($user === $this->getUser()) {
            $this->addFlash('danger', 'Vous ne pouvez pas modifier votre propre rôle.');
            return $this->redirectToRoute('admin_users');
        }

        if (in_array('ROLE_ADMIN', $user->getRoles(), true)) {
            $user->setRoles(['ROLE_USER']);
        } else {
            $user->setRoles(['ROLE_ADMIN', 'ROLE_USER']);
        }
        $em->flush();

        $this->addFlash('success', 'Rôle mis à jour pour ' . $user->getFullName() . '.');
        return $this->redirectToRoute('admin_users');
    }

    // ── Delete user ────────────────────────────────────────────────────────

    #[Route('/users/{id}/delete', name: 'user_delete', methods: ['POST'])]
    public function deleteUser(User $user, EntityManagerInterface $em, Request $request): Response
    {
        if ($user === $this->getUser()) {
            $this->addFlash('danger', 'Vous ne pouvez pas supprimer votre propre compte.');
            return $this->redirectToRoute('admin_users');
        }

        if (!$this->isCsrfTokenValid('delete-user-' . $user->getId(), $request->request->get('_token'))) {
            $this->addFlash('danger', 'Token CSRF invalide.');
            return $this->redirectToRoute('admin_users');
        }

        $em->remove($user);
        $em->flush();

        $this->addFlash('success', 'Utilisateur supprimé.');
        return $this->redirectToRoute('admin_users');
    }

    // ── Toggle newsletter opt-out ──────────────────────────────────────────

    #[Route('/users/{id}/toggle-newsletter', name: 'user_toggle_newsletter', methods: ['POST'])]
    public function toggleNewsletter(User $user, EntityManagerInterface $em): Response
    {
        $user->setNewsletterOptOut(!$user->isNewsletterOptOut());
        $em->flush();

        $this->addFlash('success', $user->getFullName() . ' : newsletter ' . ($user->isNewsletterOptOut() ? 'désactivée' : 'réactivée') . '.');
        return $this->redirectToRoute('admin_users');
    }

    // ── Newsletter ─────────────────────────────────────────────────────────

    #[Route('/newsletter', name: 'newsletter')]
    public function newsletter(): Response
    {
        return $this->render('admin/newsletter.html.twig');
    }

    #[Route('/newsletter/send', name: 'newsletter_send', methods: ['POST'])]
    public function newsletterSend(
        Request $request,
        UserRepository $userRepo,
        MailerInterface $mailer,
    ): Response {
        $sujet = trim($request->request->get('sujet', ''));
        $corps = trim($request->request->get('corps', ''));
        $cible = $request->request->get('cible', 'tous');

        if (!$sujet || !$corps) {
            $this->addFlash('danger', 'Le sujet et le corps sont obligatoires.');
            return $this->redirectToRoute('admin_newsletter');
        }

        $users = $userRepo->findAllOrderedByDate();
        $users = array_filter($users, fn(User $u) => !$u->isNewsletterOptOut());
        if ($cible === 'actifs') {
            $inactifs = array_map(fn(User $u) => $u->getId(), $userRepo->findInactifs(90));
            $users = array_filter($users, fn(User $u) => !in_array($u->getId(), $inactifs, true));
        }

        $sent = 0;
        $errors = 0;
        foreach ($users as $user) {
            try {
                $unsubscribeToken = NewsletterController::buildToken($user->getId(), $user->getEmail());
                $unsubscribeUrl = $this->generateUrl(
                    'newsletter_unsubscribe',
                    ['id' => $user->getId(), 'token' => $unsubscribeToken],
                    UrlGeneratorInterface::ABSOLUTE_URL,
                );
                $email = (new Email())
                    ->from($this->getParameter('app.contact_email'))
                    ->to($user->getEmail())
                    ->subject($sujet)
                    ->html($this->renderView('admin/email/newsletter.html.twig', [
                        'user'           => $user,
                        'corps'          => $corps,
                        'sujet'          => $sujet,
                        'unsubscribeUrl' => $unsubscribeUrl,
                    ]));
                $mailer->send($email);
                $sent++;
            } catch (\Throwable) {
                $errors++;
            }
        }

        $this->addFlash('success', "$sent email(s) envoyé(s)" . ($errors > 0 ? ", $errors erreur(s)." : '.'));
        return $this->redirectToRoute('admin_newsletter');
    }
}
