<?php

namespace App\Form;

use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\ChoiceType;
use Symfony\Component\Form\Extension\Core\Type\TextareaType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;
use Symfony\Component\Validator\Constraints\NotBlank;

class ImportElevesType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $builder
            ->add('contenu', TextareaType::class, [
                'label' => 'Liste des élèves',
                'attr' => [
                    'class' => 'form-control font-monospace',
                    'rows' => 15,
                    'placeholder' => "Un élève par ligne.\nExemples acceptés :\nDUPONT Marie\nMARTIN;Jean\nBERNARD,Sophie,F\nGARCIA Paul M",
                ],
                'constraints' => [new NotBlank(['message' => 'Veuillez coller la liste des élèves.'])],
            ])
            ->add('format', ChoiceType::class, [
                'label' => 'Format des noms',
                'attr' => ['class' => 'form-select'],
                'choices' => [
                    'NOM Prénom (par défaut)' => 'nom_prenom',
                    'Prénom NOM' => 'prenom_nom',
                ],
            ])
        ;
    }

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults([
            'contenu' => null,
            'format' => 'nom_prenom',
        ]);
    }
}
