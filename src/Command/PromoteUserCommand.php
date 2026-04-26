<?php

namespace App\Command;

use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'app:promote-user', description: 'Promouvoir un utilisateur en administrateur')]
class PromoteUserCommand extends Command
{
    public function __construct(
        private UserRepository $userRepository,
        private EntityManagerInterface $em,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addArgument('email', InputArgument::REQUIRED, 'Email de l\'utilisateur');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $email = $input->getArgument('email');

        $user = $this->userRepository->findOneBy(['email' => $email]);
        if (!$user) {
            $io->error("Aucun utilisateur trouvé avec l'email : $email");
            return Command::FAILURE;
        }

        $roles = $user->getRoles();
        if (in_array('ROLE_ADMIN', $roles, true)) {
            $io->warning("$email est déjà administrateur.");
            return Command::SUCCESS;
        }

        $user->setRoles(['ROLE_ADMIN', 'ROLE_USER']);
        $this->em->flush();

        $io->success("$email est maintenant administrateur.");
        return Command::SUCCESS;
    }
}
