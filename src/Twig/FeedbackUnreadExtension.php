<?php

namespace App\Twig;

use App\Repository\UserFeedbackRepository;
use Twig\Extension\AbstractExtension;
use Twig\TwigFunction;

class FeedbackUnreadExtension extends AbstractExtension
{
    public function __construct(private UserFeedbackRepository $repo) {}

    public function getFunctions(): array
    {
        return [
            new TwigFunction('feedback_unread_count', [$this, 'countUnread']),
        ];
    }

    public function countUnread(): int
    {
        return $this->repo->countNonLus();
    }
}
