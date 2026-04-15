<?php

namespace App\Controller;

use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;
use Symfony\Component\Security\Http\Authentication\AuthenticationUtils;

class SecurityController extends AbstractController
{
    #[Route('/login', name: 'app_login')]
    public function login(AuthenticationUtils $authenticationUtils): Response
    {
        if ($this->getUser()) {
            return $this->redirectToRoute('app_dashboard');
        }

        return $this->render('security/login.html.twig', [
            'last_username' => $authenticationUtils->getLastUsername(),
            'error'         => $authenticationUtils->getLastAuthenticationError(),
        ]);
    }

    #[Route('/logout', name: 'app_logout')]
    public function logout(): void
    {
        throw new \LogicException('This method should not be reached.');
    }

    // ── Étape 1 : saisie de l'e-mail ──────────────────────────────────

    #[Route('/mot-de-passe-oublie', name: 'app_forgot_password', methods: ['GET', 'POST'])]
    public function forgotPassword(
        Request $request,
        UserRepository $userRepository,
        EntityManagerInterface $em,
        MailerInterface $mailer,
        #[Autowire('%env(CONTACT_EMAIL)%')] string $fromEmail,
    ): Response {
        if ($this->getUser()) {
            return $this->redirectToRoute('app_dashboard');
        }

        $error   = null;
        $success = false;

        if ($request->isMethod('POST')) {
            if (!$this->isCsrfTokenValid('forgot_password', $request->request->get('_token'))) {
                $error = 'Token de sécurité invalide. Veuillez réessayer.';
            } else {
                $email = trim((string) $request->request->get('email', ''));
                $user  = $userRepository->findOneBy(['email' => $email]);

                // Toujours afficher le message de succès (anti-énumération)
                if ($user) {
                    $token     = bin2hex(random_bytes(32));
                    $expiresAt = new \DateTimeImmutable('+1 hour');

                    $user->setResetToken($token);
                    $user->setResetTokenExpiresAt($expiresAt);
                    $em->flush();

                    $resetUrl = $this->generateUrl(
                        'app_reset_password',
                        ['token' => $token],
                        UrlGeneratorInterface::ABSOLUTE_URL
                    );

                    $body = sprintf(
                        '<p>Bonjour %s,</p>
                         <p>Une demande de réinitialisation de mot de passe a été effectuée pour votre compte EPS Multi-Tools.</p>
                         <p>Cliquez sur le lien ci-dessous pour choisir un nouveau mot de passe (valable <strong>1 heure</strong>) :</p>
                         <p><a href="%s" style="background:#0f9e8e;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">
                             Réinitialiser mon mot de passe
                         </a></p>
                         <p style="color:#888;font-size:.9em;">Si vous n\'avez pas effectué cette demande, ignorez simplement cet e-mail.</p>',
                        htmlspecialchars($user->getPrenom()),
                        htmlspecialchars($resetUrl)
                    );

                    try {
                        $mail = (new Email())
                            ->from(new Address($fromEmail, 'EPS Multi-Tools'))
                            ->to($user->getEmail())
                            ->subject('Réinitialisation de votre mot de passe — EPS Multi-Tools')
                            ->html($body);

                        $mailer->send($mail);
                    } catch (\Throwable) {
                        // Silencieux côté utilisateur, mais le token est quand même enregistré
                    }
                }

                $success = true;
            }
        }

        return $this->render('security/forgot_password.html.twig', [
            'error'   => $error,
            'success' => $success,
        ]);
    }

    // ── Étape 2 : saisie du nouveau mot de passe ──────────────────────

    #[Route('/reinitialiser-mot-de-passe/{token}', name: 'app_reset_password', methods: ['GET', 'POST'])]
    public function resetPassword(
        string $token,
        Request $request,
        UserRepository $userRepository,
        EntityManagerInterface $em,
        UserPasswordHasherInterface $hasher,
    ): Response {
        if ($this->getUser()) {
            return $this->redirectToRoute('app_dashboard');
        }

        $user = $userRepository->findOneBy(['resetToken' => $token]);

        if (!$user || !$user->isResetTokenValid()) {
            return $this->render('security/reset_password.html.twig', [
                'invalid' => true,
                'token'   => $token,
            ]);
        }

        $error = null;

        if ($request->isMethod('POST')) {
            if (!$this->isCsrfTokenValid('reset_password_' . $token, $request->request->get('_token'))) {
                $error = 'Token de sécurité invalide. Veuillez réessayer.';
            } else {
                $password  = $request->request->get('password', '');
                $password2 = $request->request->get('password2', '');

                if (strlen($password) < 12) {
                    $error = 'Le mot de passe doit contenir au moins 12 caractères.';
                } elseif (!preg_match('/[A-Z]/', $password)) {
                    $error = 'Le mot de passe doit contenir au moins une majuscule.';
                } elseif (!preg_match('/[0-9]/', $password)) {
                    $error = 'Le mot de passe doit contenir au moins un chiffre.';
                } elseif (!preg_match('/[\W_]/', $password)) {
                    $error = 'Le mot de passe doit contenir au moins un caractère spécial (!, @, #, $…).';
                } elseif ($password !== $password2) {
                    $error = 'Les deux mots de passe ne correspondent pas.';
                } else {
                    $user->setPassword($hasher->hashPassword($user, $password));
                    $user->setResetToken(null);
                    $user->setResetTokenExpiresAt(null);
                    $em->flush();

                    $this->addFlash('success', 'Mot de passe modifié avec succès. Vous pouvez vous connecter.');

                    return $this->redirectToRoute('app_login');
                }
            }
        }

        return $this->render('security/reset_password.html.twig', [
            'invalid' => false,
            'token'   => $token,
            'error'   => $error,
        ]);
    }
}
