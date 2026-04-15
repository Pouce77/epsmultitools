<?php

namespace App\Form;

use App\Entity\Eleve;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\ChoiceType;
use Symfony\Component\Form\Extension\Core\Type\DateType;
use Symfony\Component\Form\Extension\Core\Type\TextType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;

class EleveType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $builder
            ->add('nom', TextType::class, [
                'label' => 'Nom',
                'attr' => ['class' => 'form-control', 'placeholder' => 'NOM'],
            ])
            ->add('prenom', TextType::class, [
                'label' => 'Prénom',
                'attr' => ['class' => 'form-control', 'placeholder' => 'Prénom'],
            ])
            ->add('sexe', ChoiceType::class, [
                'label' => 'Sexe',
                'required' => false,
                'placeholder' => '-- Non renseigné --',
                'attr' => ['class' => 'form-select'],
                'choices' => [
                    'Masculin' => 'M',
                    'Féminin' => 'F',
                ],
            ])
            ->add('dateNaissance', DateType::class, [
                'label' => 'Date de naissance (optionnel)',
                'required' => false,
                'widget' => 'single_text',
                'attr' => ['class' => 'form-control'],
                'input' => 'datetime_immutable',
            ])
            ->add('niveau', ChoiceType::class, [
                'label' => 'Niveau EPS (optionnel)',
                'required' => false,
                'placeholder' => '-- Non renseigné --',
                'attr' => ['class' => 'form-select'],
                'choices' => [
                    '1 — Faible'    => 1,
                    '2 — Moyen −'   => 2,
                    '3 — Moyen'     => 3,
                    '4 — Moyen +'   => 4,
                    '5 — Fort'      => 5,
                ],
            ])
        ;
    }

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults([
            'data_class' => Eleve::class,
        ]);
    }
}
