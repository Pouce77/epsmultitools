<?php

namespace App\Command;

use App\Controller\AccountController;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\DependencyInjection\ParameterBag\ParameterBagInterface;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Email;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;
use Twig\Environment;

#[AsCommand(
    name: 'app:cleanup-inactive-users',
    description: 'Envoie les avertissements aux comptes inactifs depuis 6 mois et supprime ceux qui ne répondent pas.',
)]
class CleanupInactiveUsersCommand extends Command
{
    public function __construct(
        private UserRepository $userRepo,
        private EntityManagerInterface $em,
        private MailerInterface $mailer,
        private UrlGeneratorInterface $router,
        private Environment $twig,
        private ParameterBagInterface $params,
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io   = new SymfonyStyle($input, $output);
        $from = $this->params->get('app.contact_email');

        // ── Phase 1 : envoyer les avertissements ──────────────────────────
        $aAvertir = array_filter(
            $this->userRepo->findAavertir(),
            fn($u) => !in_array('ROLE_ADMIN', $u->getRoles(), true),
        );

        $sent = 0;
        foreach ($aAvertir as $user) {
            try {
                $token     = AccountController::buildDeletionToken($user->getId(), $user->getEmail());
                $deleteUrl = $this->router->generate('account_delete', ['id' => $user->getId(), 'token' => $token], UrlGeneratorInterface::ABSOLUTE_URL);
                $loginUrl  = $this->router->generate('app_login', [], UrlGeneratorInterface::ABSOLUTE_URL);

                $html = $this->twig->render('admin/email/avertissement_inactivite.html.twig', [
                    'user'      => $user,
                    'deleteUrl' => $deleteUrl,
                    'loginUrl'  => $loginUrl,
                ]);

                $this->mailer->send(
                    (new Email())
                        ->from($from)
                        ->to($user->getEmail())
                        ->subject('Votre compte EPS Multi-Tools va être supprimé')
                        ->html($html),
                );

                $user->setWarningEmailSentAt(new \DateTimeImmutable());
                $sent++;
            } catch (\Throwable $e) {
                $io->warning('Erreur email pour ' . $user->getEmail() . ' : ' . $e->getMessage());
            }
        }

        $this->em->flush();
        $io->success("$sent avertissement(s) envoyé(s).");

        // ── Phase 2 : supprimer les comptes expirés ───────────────────────
        $aSupprimer = array_filter(
            $this->userRepo->findASupprimer(),
            fn($u) => !in_array('ROLE_ADMIN', $u->getRoles(), true),
        );

        $deleted = 0;
        foreach ($aSupprimer as $user) {
            $this->em->remove($user);
            $deleted++;
        }

        $this->em->flush();
        $io->success("$deleted compte(s) supprimé(s).");

        return Command::SUCCESS;
    }
}
