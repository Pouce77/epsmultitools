<?php

namespace App\Form;

use App\Entity\User;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\EmailType;
use Symfony\Component\Form\Extension\Core\Type\PasswordType;
use Symfony\Component\Form\Extension\Core\Type\RepeatedType;
use Symfony\Component\Form\Extension\Core\Type\TextType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;
use Symfony\Component\Validator\Constraints\Length;
use Symfony\Component\Validator\Constraints\Regex;

class ProfileFormType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $builder
            ->add('prenom', TextType::class, [
                'label' => 'Prénom',
                'attr'  => ['class' => 'form-control'],
            ])
            ->add('nom', TextType::class, [
                'label' => 'Nom',
                'attr'  => ['class' => 'form-control'],
            ])
            ->add('email', EmailType::class, [
                'label' => 'Adresse e-mail',
                'attr'  => ['class' => 'form-control'],
            ])
            ->add('etablissement', TextType::class, [
                'label'    => 'Établissement (optionnel)',
                'required' => false,
                'attr'     => ['class' => 'form-control', 'placeholder' => 'Collège / Lycée …'],
            ])
            ->add('newPassword', RepeatedType::class, [
                'type'     => PasswordType::class,
                'mapped'   => false,
                'required' => false,
                'first_options' => [
                    'label' => 'Nouveau mot de passe',
                    'attr'  => ['class' => 'form-control', 'autocomplete' => 'new-password'],
                    'constraints' => [
                        new Length([
                            'min'        => 12,
                            'minMessage' => 'Le mot de passe doit contenir au moins {{ limit }} caractères.',
                        ]),
                        new Regex([
                            'pattern' => '/[A-Z]/',
                            'message' => 'Le mot de passe doit contenir au moins une majuscule.',
                        ]),
                        new Regex([
                            'pattern' => '/[a-z]/',
                            'message' => 'Le mot de passe doit contenir au moins une minuscule.',
                        ]),
                        new Regex([
                            'pattern' => '/[0-9]/',
                            'message' => 'Le mot de passe doit contenir au moins un chiffre.',
                        ]),
                        new Regex([
                            'pattern' => '/[\W_]/',
                            'message' => 'Le mot de passe doit contenir au moins un caractère spécial (!, @, #, $…).',
                        ]),
                    ],
                ],
                'second_options' => [
                    'label' => 'Confirmer le nouveau mot de passe',
                    'attr'  => ['class' => 'form-control'],
                ],
                'invalid_message' => 'Les mots de passe ne correspondent pas.',
            ])
        ;
    }

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults([
            'data_class' => User::class,
        ]);
    }
}
