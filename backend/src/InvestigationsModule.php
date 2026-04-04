<?php

namespace NewSolari\Investigations;

use NewSolari\Core\Module\Contracts\ModuleInterface;

class InvestigationsModule implements ModuleInterface
{
    public function getId(): string { return 'investigations'; }
    public function getName(): string { return 'Investigations'; }
    public function getVersion(): string { return '1.0.0'; }
    public function getType(): string { return 'meta-app'; }

    public function install(): void {}
    public function uninstall(): void {}
    public function enable(): void {}
    public function disable(): void {}

    public function getDependencies(): array { return ['core' => '>=1.0.0']; }
    public function getOptionalDependencies(): array { return []; }
    public function getServiceContract(): ?string { return null; }

    public function getFrontendManifest(): ?array
    {
        $manifest = json_decode(file_get_contents(__DIR__ . '/../module.json'), true);
        return $manifest['frontend'] ?? null;
    }
}
