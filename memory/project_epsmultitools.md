---
name: EPS Multi-Tools project
description: Symfony 7.4 web app for French EPS teachers — class/student management + 5 interactive teaching tools
type: project
---
Full Symfony 7.4 app (PHP 8.2, PostgreSQL, Doctrine ORM, Stimulus JS, Bootstrap 5 via CDN, AssetMapper).

Entities: User (teacher), Classe (school class), Eleve (student).

Features built:
- Landing page (home/index.html.twig)
- Auth: login + registration (SecurityController, RegistrationController)  
- Dashboard: teacher's class overview with tool shortcuts
- Class CRUD + student import from pasted text (ImportElevesService)
- Student CRUD per class
- 5 interactive tools (all client-side Stimulus JS):
  1. Vitesse (/outils/{classeId}/vitesse) — timer + speed calc per student
  2. Scores (/outils/{classeId}/scores) — scoreboard with timer
  3. Actions (/outils/{classeId}/actions) — action counter per student/type
  4. Tournoi (/outils/{classeId}/tournoi) — round-robin or elimination bracket
  5. Equipes (/outils/{classeId}/equipes) — balanced team builder with gender balance

All tool data flows via `data-*-eleves-value` JSON attribute from PHP to Stimulus.
Security: Doctrine entity provider, form_login firewall, ownership checks via `findOneByIdAndEnseignant()`.

**Why:** Build a free digital tool platform for EPS teachers to manage their classes and run interactive sessions.
**How to apply:** When extending, follow the pattern of OutilController — fetch class with ownership check, encode eleves as JSON, pass to template, use Stimulus controller for all interactivity.
