<?php

namespace App\Twig;

use App\Entity\GlobalMessage;
use App\Repository\GlobalMessageRepository;
use Twig\Extension\AbstractExtension;
use Twig\TwigFunction;

class GlobalMessageExtension extends AbstractExtension
{
    public function __construct(private GlobalMessageRepository $repo) {}

    public function getFunctions(): array
    {
        return [
            new TwigFunction('global_banner', [$this, 'getActiveBanner']),
        ];
    }

    public function getActiveBanner(): ?GlobalMessage
    {
        return $this->repo->findActive();
    }
}
