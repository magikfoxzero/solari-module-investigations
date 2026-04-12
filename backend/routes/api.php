<?php

use Illuminate\Support\Facades\Route;
use NewSolari\Investigations\Controllers\InvestigationsController;
use NewSolari\Investigations\Controllers\InvestigationAIController;

// Channel auth (called by WebSocket service for investigation.canvas.* channels)
Route::middleware(['service.token'])
    ->post('api/investigations/channel-auth', [InvestigationsController::class, 'channelAuth']);

Route::middleware(['auth.api', 'module.enabled:investigations', 'partition.app:investigations-meta-app'])
    ->prefix('api/investigations')
    ->group(function () {
        // Export must be defined before /{id} routes
        Route::middleware(['permission:investigations.export'])->get('/export', [InvestigationsController::class, 'export']);
        Route::middleware(['permission:investigations.read'])->group(function () {
            Route::get('/', [InvestigationsController::class, 'index']);
            Route::get('/search', [InvestigationsController::class, 'search']);
            Route::get('/stats', [InvestigationsController::class, 'statistics']);
            Route::get('/{id}', [InvestigationsController::class, 'show']);
            // Visualization endpoints
            Route::get('/{id}/timeline', [InvestigationsController::class, 'getTimeline']);
            Route::get('/{id}/graph', [InvestigationsController::class, 'getGraph']);
            // Node and connection read operations
            Route::get('/{id}/relationships/existing', [InvestigationsController::class, 'findExistingRelationships']);
        });
        Route::middleware(['permission:investigations.create'])->post('/', [InvestigationsController::class, 'store']);
        Route::middleware(['permission:investigations.update'])->group(function () {
            Route::put('/{id}', [InvestigationsController::class, 'update']);
            // Canvas state and layout
            Route::put('/{id}/canvas', [InvestigationsController::class, 'updateCanvas']);
            Route::post('/{id}/layout', [InvestigationsController::class, 'applyLayout']);
            // Node management - bulk/positions before /{nodeId} to avoid conflict
            // API-MED-NEW-007: Bulk endpoints use idempotency middleware for retry safety
            Route::post('/{id}/nodes/bulk', [InvestigationsController::class, 'bulkStoreNodes'])->middleware('idempotent');
            Route::put('/{id}/nodes/positions', [InvestigationsController::class, 'updateNodePositions'])->middleware('idempotent');
            Route::post('/{id}/nodes', [InvestigationsController::class, 'storeNode']);
            Route::put('/{id}/nodes/{nodeId}', [InvestigationsController::class, 'updateNode']);
            Route::delete('/{id}/nodes/{nodeId}', [InvestigationsController::class, 'destroyNode']);
            // Connection management
            Route::post('/{id}/connections', [InvestigationsController::class, 'storeConnection']);
            Route::put('/{id}/connections/{connectionId}', [InvestigationsController::class, 'updateConnection']);
            Route::delete('/{id}/connections/{connectionId}', [InvestigationsController::class, 'destroyConnection']);
            // Drawing management - batch before /{drawingId} to avoid conflict
            // API-MED-NEW-007: Bulk endpoints use idempotency middleware for retry safety
            Route::put('/{id}/drawings/batch', [InvestigationsController::class, 'batchUpdateDrawings'])->middleware('idempotent');
            Route::post('/{id}/drawings', [InvestigationsController::class, 'storeDrawing']);
            Route::put('/{id}/drawings/{drawingId}', [InvestigationsController::class, 'updateDrawing']);
            Route::delete('/{id}/drawings/{drawingId}', [InvestigationsController::class, 'destroyDrawing']);
            // AI features
            Route::post('/{id}/ai/summarize-node', [InvestigationAIController::class, 'summarizeNode']);
            Route::post('/{id}/ai/summarize-file', [InvestigationAIController::class, 'summarizeFile']);
            Route::post('/{id}/ai/summarize', [InvestigationAIController::class, 'summarizeInvestigation']);
            Route::post('/{id}/ai/correlations', [InvestigationAIController::class, 'analyzeCorrelations']);
            Route::post('/{id}/ai/generate', [InvestigationAIController::class, 'generateMindMap']);
            Route::post('/{id}/ai/apply-mindmap', [InvestigationAIController::class, 'applyMindMap']);
            Route::post('/{id}/ai/analyze-suggestions', [InvestigationAIController::class, 'analyzeSuggestions']);
            Route::post('/{id}/ai/accept-duplicate', [InvestigationAIController::class, 'acceptDuplicateSuggestion']);
            Route::post('/{id}/ai/accept-connection', [InvestigationAIController::class, 'acceptConnectionSuggestion']);
        });
        Route::middleware(['permission:investigations.delete'])->delete('/{id}', [InvestigationsController::class, 'destroy']);
    });
