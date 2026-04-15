<?php

namespace App\Service;

use App\Entity\Classe;
use App\Entity\Eleve;

class ImportElevesService
{
    /**
     * Parse a text block and return an array of Eleve entities (not yet persisted).
     * Each line can be: "NOM Prénom", "NOM;Prénom", "NOM,Prénom", "NOM Prénom M/F"
     *
     * @return Eleve[]
     */
    public function parse(string $content, string $format, Classe $classe): array
    {
        $eleves = [];
        $lines = preg_split('/\r?\n/', $content);

        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#')) {
                continue;
            }

            $sexe = null;

            // Extract trailing gender indicator (M or F)
            if (preg_match('/\s+([MF])$/i', $line, $matches)) {
                $sexe = strtoupper($matches[1]);
                $line = trim(substr($line, 0, -strlen($matches[0])));
            }

            // Detect separator: semicolon, comma, tab, or space
            if (str_contains($line, ';')) {
                $parts = explode(';', $line, 2);
            } elseif (str_contains($line, ',')) {
                $parts = explode(',', $line, 2);
            } elseif (str_contains($line, "\t")) {
                $parts = explode("\t", $line, 2);
            } else {
                // Split on first space
                $spacePos = strpos($line, ' ');
                if ($spacePos === false) {
                    // Single word — use as nom only
                    $parts = [$line, ''];
                } else {
                    $parts = [substr($line, 0, $spacePos), substr($line, $spacePos + 1)];
                }
            }

            $part1 = trim($parts[0] ?? '');
            $part2 = trim($parts[1] ?? '');

            if ($part1 === '' && $part2 === '') {
                continue;
            }

            if ($format === 'prenom_nom') {
                $prenom = $part1;
                $nom = $part2 !== '' ? $part2 : $part1;
                if ($part2 === '') {
                    $prenom = '';
                }
            } else {
                // Default: NOM Prénom
                $nom = $part1;
                $prenom = $part2;
            }

            if ($nom === '') {
                continue;
            }

            $eleve = new Eleve();
            $eleve->setNom($nom);
            $eleve->setPrenom($prenom !== '' ? $prenom : $nom);
            $eleve->setSexe($sexe);
            $eleve->setClasse($classe);

            $eleves[] = $eleve;
        }

        return $eleves;
    }
}
