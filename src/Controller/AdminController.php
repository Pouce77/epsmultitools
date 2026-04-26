<?php

namespace App\Controller;

use App\Controller\AccountController;
use App\Entity\GlobalMessage;
use App\Entity\User;
use App\Repository\AdminLogRepository;
use App\Repository\ClasseRepository;
use App\Repository\GlobalMessageRepository;
use App\Repository\ResultatOutilRepository;
use App\Repository\UserFeedbackRepository;
use App\Repository\UserRepository;
use App\Service\AdminLogger;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
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
            'nbUsers'                => $userRepo->countTotal(),
            'nbUsersMonth'           => $userRepo->countThisMonth(),
            'nbClasses'              => $classeRepo->count([]),
            'nbResultats'            => $resultatRepo->countTotal(),
            'outilsStats'            => $resultatRepo->countByOutilWithTrend(),
            'inscriptionsData'       => $userRepo->inscriptionsParMois(6),
            'retentionData'          => $resultatRepo->activeUsersParMois(6),
            'statsEtablissement'     => $userRepo->statsParEtablissement(),
            'topEtablissementsActifs'=> $resultatRepo->topEtablissementsActifs(10),
            'heatmapData'            => $heatmapData,
            'heatmapMax'             => $heatmapMax,
        ]);
    }

    // ── Users list ─────────────────────────────────────────────────────────

    #[Route('/users', name: 'users')]
    public function users(UserRepository $userRepo, Request $request): Response
    {
        $q    = trim($request->query->get('q', ''));
        $role = $request->query->get('role', 'tous');
        $page = max(1, (int) $request->query->get('page', 1));

        $result         = $userRepo->findFiltered($q, $role, $page);
        $lastActivities = $userRepo->lastActivitiesMap();

        return $this->render('admin/users.html.twig', [
            'users'          => $result['users'],
            'total'          => $result['total'],
            'pages'          => $result['pages'],
            'page'           => $page,
            'q'              => $q,
            'role'           => $role,
            'lastActivities' => $lastActivities,
            'aAvertir'       => $userRepo->findAavertir(),
            'aSupprimer'     => $userRepo->findASupprimer(),
        ]);
    }

    // ── Export CSV ─────────────────────────────────────────────────────────

    #[Route('/users/export-csv', name: 'users_export_csv')]
    public function exportCsv(UserRepository $userRepo): StreamedResponse
    {
        $users = $userRepo->findAllOrderedByDate();

        $response = new StreamedResponse(function () use ($users) {
            $fp = fopen('php://output', 'w');
            fprintf($fp, chr(0xEF).chr(0xBB).chr(0xBF));
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
    public function sendWarning(User $user, EntityManagerInterface $em, MailerInterface $mailer, AdminLogger $logger): Response
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

        $logger->log($this->getUser(), 'Avertissement inactivité envoyé', $user);
        $this->addFlash('success', 'Avertissement envoyé à ' . $user->getFullName() . '.');
        return $this->redirectToRoute('admin_users');
    }

    // ── Toggle admin role ──────────────────────────────────────────────────

    #[Route('/users/{id}/toggle-admin', name: 'user_toggle_admin', methods: ['POST'])]
    public function toggleAdmin(User $user, EntityManagerInterface $em, AdminLogger $logger): Response
    {
        if ($user === $this->getUser()) {
            $this->addFlash('danger', 'Vous ne pouvez pas modifier votre propre rôle.');
            return $this->redirectToRoute('admin_users');
        }

        $isAdmin = in_array('ROLE_ADMIN', $user->getRoles(), true);
        $user->setRoles($isAdmin ? ['ROLE_USER'] : ['ROLE_ADMIN', 'ROLE_USER']);
        $em->flush();

        $logger->log($this->getUser(), $isAdmin ? 'Rétrogradation admin' : 'Promotion admin', $user);
        $this->addFlash('success', 'Rôle mis à jour pour ' . $user->getFullName() . '.');
        return $this->redirectToRoute('admin_users');
    }

    // ── Delete user ────────────────────────────────────────────────────────

    #[Route('/users/{id}/delete', name: 'user_delete', methods: ['POST'])]
    public function deleteUser(User $user, EntityManagerInterface $em, Request $request, AdminLogger $logger): Response
    {
        if ($user === $this->getUser()) {
            $this->addFlash('danger', 'Vous ne pouvez pas supprimer votre propre compte.');
            return $this->redirectToRoute('admin_users');
        }

        if (!$this->isCsrfTokenValid('delete-user-' . $user->getId(), $request->request->get('_token'))) {
            $this->addFlash('danger', 'Token CSRF invalide.');
            return $this->redirectToRoute('admin_users');
        }

        $logger->log($this->getUser(), 'Suppression utilisateur', $user);
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
    public function newsletterSend(Request $request, UserRepository $userRepo, MailerInterface $mailer): Response
    {
        $sujet = trim($request->request->get('sujet', ''));
        $corps = trim($request->request->get('corps', ''));
        $cible = $request->request->get('cible', 'tous');

        if (!$sujet || !$corps) {
            $this->addFlash('danger', 'Le sujet et le corps sont obligatoires.');
            return $this->redirectToRoute('admin_newsletter');
        }

        $users = array_filter($userRepo->findAllOrderedByDate(), fn(User $u) => !$u->isNewsletterOptOut());
        if ($cible === 'actifs') {
            $inactifsIds = array_map(fn(User $u) => $u->getId(), $userRepo->findInactifs(90));
            $users = array_filter($users, fn(User $u) => !in_array($u->getId(), $inactifsIds, true));
        }

        $sent = 0; $errors = 0;
        foreach ($users as $user) {
            try {
                $unsubscribeToken = NewsletterController::buildToken($user->getId(), $user->getEmail());
                $unsubscribeUrl   = $this->generateUrl('newsletter_unsubscribe', ['id' => $user->getId(), 'token' => $unsubscribeToken], UrlGeneratorInterface::ABSOLUTE_URL);
                $mailer->send(
                    (new Email())
                        ->from($this->getParameter('app.contact_email'))
                        ->to($user->getEmail())
                        ->subject($sujet)
                        ->html($this->renderView('admin/email/newsletter.html.twig', ['user' => $user, 'corps' => $corps, 'sujet' => $sujet, 'unsubscribeUrl' => $unsubscribeUrl]))
                );
                $sent++;
            } catch (\Throwable) { $errors++; }
        }

        $this->addFlash('success', "$sent email(s) envoyé(s)" . ($errors > 0 ? ", $errors erreur(s)." : '.'));
        return $this->redirectToRoute('admin_newsletter');
    }

    // ── Bannière globale ───────────────────────────────────────────────────

    #[Route('/banniere', name: 'banniere')]
    public function banniere(GlobalMessageRepository $repo): Response
    {
        return $this->render('admin/banniere.html.twig', ['messages' => $repo->findAll()]);
    }

    #[Route('/banniere/create', name: 'banniere_create', methods: ['POST'])]
    public function banniereCreate(Request $request, EntityManagerInterface $em): Response
    {
        $contenu = trim($request->request->get('contenu', ''));
        $type    = $request->request->get('type', 'info');

        if ($contenu !== '' && in_array($type, ['info', 'success', 'warning', 'danger'], true)) {
            $msg = (new GlobalMessage())->setContenu($contenu)->setType($type)->setActif(true);
            $em->persist($msg);
            $em->flush();
            $this->addFlash('success', 'Bannière créée.');
        }

        return $this->redirectToRoute('admin_banniere');
    }

    #[Route('/banniere/{id}/toggle', name: 'banniere_toggle', methods: ['POST'])]
    public function banniereToggle(GlobalMessage $message, EntityManagerInterface $em): Response
    {
        $message->setActif(!$message->isActif());
        $em->flush();
        return $this->redirectToRoute('admin_banniere');
    }

    #[Route('/banniere/{id}/delete', name: 'banniere_delete', methods: ['POST'])]
    public function banniereDelete(GlobalMessage $message, EntityManagerInterface $em): Response
    {
        $em->remove($message);
        $em->flush();
        $this->addFlash('success', 'Bannière supprimée.');
        return $this->redirectToRoute('admin_banniere');
    }

    // ── Journal d'activité ─────────────────────────────────────────────────

    #[Route('/logs', name: 'logs')]
    public function logs(AdminLogRepository $logRepo): Response
    {
        return $this->render('admin/logs.html.twig', ['logs' => $logRepo->findRecent(200)]);
    }

    // ── Utilisateurs jamais actifs ─────────────────────────────────────────

    #[Route('/users/jamais-actifs', name: 'users_jamais_actifs')]
    public function jamaisActifs(UserRepository $userRepo): Response
    {
        return $this->render('admin/jamais_actifs.html.twig', [
            'users' => $userRepo->findJamaisActifs(),
        ]);
    }

    // ── Logs d'erreurs applicatives ────────────────────────────────────────

    #[Route('/logs-erreurs', name: 'logs_erreurs')]
    public function logsErreurs(): Response
    {
        $logFile = $this->getParameter('kernel.logs_dir')
            . DIRECTORY_SEPARATOR
            . $this->getParameter('kernel.environment') . '.log';

        $entries = [];
        if (is_file($logFile) && is_readable($logFile)) {
            $lines = file($logFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
            // Read last 3000 lines to find up to 150 errors
            $lines = array_slice($lines, -3000);
            foreach (array_reverse($lines) as $line) {
                // Format: [date] channel.LEVEL: message {context} []
                if (!preg_match('/^\[(.+?)\] (\w+)\.(\w+): (.+?)(\s*\{.*)?$/', $line, $m)) {
                    continue;
                }
                $level = strtoupper($m[3]);
                if (!in_array($level, ['ERROR', 'CRITICAL', 'ALERT', 'EMERGENCY', 'WARNING'], true)) {
                    continue;
                }
                $entries[] = [
                    'date'    => $m[1],
                    'channel' => $m[2],
                    'level'   => $level,
                    'message' => $m[4],
                    'context' => isset($m[5]) ? trim($m[5]) : '',
                ];
                if (count($entries) >= 150) {
                    break;
                }
            }
        }

        return $this->render('admin/logs_erreurs.html.twig', [
            'entries'  => $entries,
            'logFile'  => basename($logFile),
            'exists'   => is_file($logFile),
        ]);
    }

    // ── Export complet JSON ────────────────────────────────────────────────

    #[Route('/export-data', name: 'export_data')]
    public function exportData(UserRepository $userRepo, ResultatOutilRepository $resultatRepo): StreamedResponse
    {
        $response = new StreamedResponse(function () use ($userRepo, $resultatRepo) {
            $users = $userRepo->findAllOrderedByDate();
            $data  = [];
            foreach ($users as $u) {
                $data[] = [
                    'id'            => $u->getId(),
                    'prenom'        => $u->getPrenom(),
                    'nom'           => $u->getNom(),
                    'email'         => $u->getEmail(),
                    'etablissement' => $u->getEtablissement(),
                    'roles'         => $u->getRoles(),
                    'createdAt'     => $u->getCreatedAt()->format('Y-m-d H:i:s'),
                    'classes'       => array_map(
                        fn($c) => ['id' => $c->getId(), 'nom' => $c->getNom(), 'effectif' => $c->getEffectif()],
                        $u->getClasses()->toArray()
                    ),
                ];
            }
            echo json_encode(['exportedAt' => date('Y-m-d H:i:s'), 'users' => $data], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        });

        $response->headers->set('Content-Type', 'application/json; charset=UTF-8');
        $response->headers->set('Content-Disposition', 'attachment; filename="export_' . date('Y-m-d') . '.json"');

        return $response;
    }

    // ── Métriques de conversion ────────────────────────────────────────────

    #[Route('/conversion', name: 'conversion')]
    public function conversion(UserRepository $userRepo): Response
    {
        return $this->render('admin/conversion.html.twig', [
            'stats' => $userRepo->getConversionStats(),
        ]);
    }

    // ── Stats détaillées par outil ─────────────────────────────────────────

    #[Route('/outils', name: 'outils')]
    public function outils(ResultatOutilRepository $resultatRepo): Response
    {
        return $this->render('admin/outils_stats.html.twig', [
            'stats' => $resultatRepo->getOutilsDetailedStats(),
        ]);
    }

    // ── Feedbacks utilisateurs ─────────────────────────────────────────────

    #[Route('/feedbacks', name: 'feedbacks')]
    public function feedbacks(UserFeedbackRepository $feedbackRepo, EntityManagerInterface $em): Response
    {
        $feedbacks = $feedbackRepo->findBy([], ['createdAt' => 'DESC']);

        // Mark unread as read on visit
        foreach ($feedbacks as $f) {
            if (!$f->isLu()) {
                $f->setLu(true);
            }
        }
        $em->flush();

        return $this->render('admin/feedbacks.html.twig', ['feedbacks' => $feedbacks]);
    }

    // ── Import CSV ─────────────────────────────────────────────────────────

    #[Route('/import-csv', name: 'import_csv', methods: ['GET'])]
    public function importCsv(): Response
    {
        return $this->render('admin/import_csv.html.twig');
    }

    #[Route('/import-csv', name: 'import_csv_post', methods: ['POST'])]
    public function importCsvPost(
        Request $request,
        EntityManagerInterface $em,
        UserRepository $userRepo,
        UserPasswordHasherInterface $hasher,
        AdminLogger $logger,
    ): Response {
        if (!$this->isCsrfTokenValid('import-csv', $request->request->get('_token'))) {
            $this->addFlash('danger', 'Token CSRF invalide.');
            return $this->redirectToRoute('admin_import_csv');
        }

        $file = $request->files->get('csv');

        if (!$file) {
            $this->addFlash('danger', 'Aucun fichier reçu.');
            return $this->redirectToRoute('admin_import_csv');
        }

        if ($file->getSize() > 2 * 1024 * 1024) {
            $this->addFlash('danger', 'Fichier trop volumineux (max 2 Mo).');
            return $this->redirectToRoute('admin_import_csv');
        }

        $allowedMimes = ['text/csv', 'text/plain', 'application/csv', 'application/vnd.ms-excel'];
        if (!in_array($file->getMimeType(), $allowedMimes, true)) {
            $this->addFlash('danger', 'Format invalide. Attendu : fichier CSV.');
            return $this->redirectToRoute('admin_import_csv');
        }

        $handle   = fopen($file->getPathname(), 'r');
        fgetcsv($handle, 0, ';'); // skip header row

        $imported = 0;
        $skipped  = 0;
        $errors   = [];
        $row      = 1;

        while (($cols = fgetcsv($handle, 0, ';')) !== false) {
            $row++;
            if (count($cols) < 3) {
                $errors[] = "Ligne $row : données insuffisantes (prenom;nom;email[;etablissement]).";
                continue;
            }

            [$prenom, $nom, $email] = array_map('trim', $cols);
            $etablissement = isset($cols[3]) ? trim($cols[3]) : null;
            $plainPassword = isset($cols[4]) && $cols[4] !== '' ? trim($cols[4]) : bin2hex(random_bytes(8));

            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $errors[] = "Ligne $row : email invalide « $email ».";
                continue;
            }
            if ($prenom === '' || $nom === '') {
                $errors[] = "Ligne $row : prénom ou nom manquant.";
                continue;
            }
            if ($userRepo->findOneBy(['email' => $email])) {
                $skipped++;
                continue;
            }

            $user = new User();
            $user->setPrenom(substr($prenom, 0, 100))
                 ->setNom(substr($nom, 0, 100))
                 ->setEmail($email)
                 ->setEtablissement($etablissement ? substr($etablissement, 0, 200) : null)
                 ->setPassword($hasher->hashPassword($user, $plainPassword));

            $em->persist($user);
            $imported++;
        }
        fclose($handle);
        $em->flush();

        $logger->log($this->getUser(), "Import CSV : $imported importé(s), $skipped ignoré(s)");
        $this->addFlash('success', "$imported utilisateur(s) importé(s), $skipped ignoré(s) (email existant).");
        if ($errors) {
            foreach (array_slice($errors, 0, 10) as $err) {
                $this->addFlash('warning', $err);
            }
        }

        return $this->redirectToRoute('admin_import_csv');
    }

    // ── Détection de doublons ──────────────────────────────────────────────

    #[Route('/doublons', name: 'doublons')]
    public function doublons(UserRepository $userRepo): Response
    {
        return $this->render('admin/doublons.html.twig', [
            'doublons' => $userRepo->findDoublons(),
        ]);
    }
}
