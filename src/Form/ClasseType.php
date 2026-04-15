<?php

namespace App\Form;

use App\Entity\Classe;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\ChoiceType;
use Symfony\Component\Form\Extension\Core\Type\TextType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;

class ClasseType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $builder
            ->add('nom', TextType::class, [
                'label' => 'Nom de la classe',
                'attr' => ['class' => 'form-control', 'placeholder' => 'ex: 3ème A, Terminale B...'],
            ])
            ->add('niveau', ChoiceType::class, [
                'label' => 'Niveau',
                'required' => false,
                'placeholder' => '-- Choisir un niveau --',
                'attr' => ['class' => 'form-select'],
                'choices' => [
                    'Collège' => [
                        '6ème' => '6ème',
                        '5ème' => '5ème',
                        '4ème' => '4ème',
                        '3ème' => '3ème',
                    ],
                    'Lycée' => [
                        'Seconde' => 'Seconde',
                        'Première' => 'Première',
                        'Terminale' => 'Terminale',
                    ],
                    'Autre' => [
                        'BTS' => 'BTS',
                        'Autre' => 'Autre',
                    ],
                ],
            ])
            ->add('anneeScolaire', TextType::class, [
                'label' => 'Année scolaire',
                'attr' => ['class' => 'form-control', 'placeholder' => 'ex: 2025-2026'],
            ])
        ;
    }

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults([
            'data_class' => Classe::class,
        ]);
    }
}
