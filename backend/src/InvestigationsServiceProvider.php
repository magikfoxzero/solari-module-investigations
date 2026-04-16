<?php

namespace NewSolari\Investigations;

use Illuminate\Support\ServiceProvider;
use NewSolari\Core\Module\ModuleRegistry;

class InvestigationsServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(InvestigationsModule::class);
    }

    public function boot(): void
    {
        // Register polymorphic morph map
        \Illuminate\Database\Eloquent\Relations\Relation::morphMap([
            'investigation' => \NewSolari\Investigations\Models\Investigation::class,
            'investigations' => \NewSolari\Investigations\Models\Investigation::class,
        ]);

        // Register with module system
        if ($this->app->bound(ModuleRegistry::class)) {
            app(ModuleRegistry::class)->register(app(InvestigationsModule::class));
        }

        // Register with shareable type registry
        if (app()->bound(\NewSolari\Core\Services\ShareableTypeRegistry::class)) {
            app(\NewSolari\Core\Services\ShareableTypeRegistry::class)
                ->register('investigations', \NewSolari\Investigations\Models\Investigation::class, 'investigation');
        }

        // Load routes
        $this->loadRoutesFrom(__DIR__ . '/../routes/api.php');

        // Load migrations (if any module-specific migrations exist)
        if (is_dir(__DIR__ . '/../database/migrations')) {
            $this->loadMigrationsFrom(__DIR__ . '/../database/migrations');
        }
    }
}
