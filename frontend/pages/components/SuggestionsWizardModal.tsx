import { useState, useCallback, useEffect } from 'react';
import { X, Loader2, CheckCircle2, SkipForward, Square, Sparkles, AlertCircle, PartyPopper } from 'lucide-react';
import { DuplicateSuggestionView } from './DuplicateSuggestionView';
import { ConnectionSuggestionView } from './ConnectionSuggestionView';
import { useInvestigationsStore } from '@/modules/investigations/store';
import {
  analyzeSuggestions,
  acceptDuplicateSuggestion,
  acceptConnectionSuggestion,
} from '../../api';
import type {
  Suggestion,
  DuplicateSuggestion,
  ConnectionSuggestion,
  SuggestionWizardState,
} from '@/modules/investigations/types';

interface SuggestionsWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function isDuplicateSuggestion(suggestion: Suggestion): suggestion is DuplicateSuggestion {
  return suggestion.type === 'exact_duplicate' || suggestion.type === 'semantic_duplicate';
}

function isConnectionSuggestion(suggestion: Suggestion): suggestion is ConnectionSuggestion {
  return suggestion.type === 'database_connection' || suggestion.type === 'ai_connection';
}

export function SuggestionsWizardModal({ isOpen, onClose }: SuggestionsWizardModalProps) {
  const { currentInvestigation, loadInvestigation } = useInvestigationsStore();

  const [state, setState] = useState<SuggestionWizardState>({
    status: 'idle',
    suggestions: [],
    currentIndex: 0,
    accepted: 0,
    skipped: 0,
  });

  // Start analysis when modal opens
  useEffect(() => {
    if (isOpen && currentInvestigation && state.status === 'idle') {
      startAnalysis();
    }
  }, [isOpen, currentInvestigation]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setState({
        status: 'idle',
        suggestions: [],
        currentIndex: 0,
        accepted: 0,
        skipped: 0,
      });
    }
  }, [isOpen]);

  const startAnalysis = useCallback(async () => {
    if (!currentInvestigation) return;

    setState(prev => ({ ...prev, status: 'loading' }));

    try {
      const result = await analyzeSuggestions(currentInvestigation.record_id);

      if (result.suggestions.length === 0) {
        setState(prev => ({ ...prev, status: 'empty' }));
      } else {
        setState(prev => ({
          ...prev,
          status: 'ready',
          suggestions: result.suggestions,
          currentIndex: 0,
        }));
      }
    } catch (err) {
      setState(prev => ({
        ...prev,
        status: 'error',
        error: err instanceof Error ? err.message : 'Failed to analyze suggestions',
      }));
    }
  }, [currentInvestigation]);

  const currentSuggestion = state.suggestions[state.currentIndex];
  const isLastSuggestion = state.currentIndex >= state.suggestions.length - 1;
  const progress = state.suggestions.length > 0
    ? ((state.currentIndex + 1) / state.suggestions.length) * 100
    : 0;

  const moveToNext = useCallback(() => {
    if (isLastSuggestion) {
      setState(prev => ({ ...prev, status: 'complete' }));
    } else {
      setState(prev => ({ ...prev, currentIndex: prev.currentIndex + 1 }));
    }
  }, [isLastSuggestion]);

  const handleAccept = useCallback(async () => {
    if (!currentInvestigation || !currentSuggestion) return;

    setState(prev => ({ ...prev, status: 'processing' }));

    try {
      if (isDuplicateSuggestion(currentSuggestion)) {
        await acceptDuplicateSuggestion(
          currentInvestigation.record_id,
          currentSuggestion.keepNode.record_id,
          currentSuggestion.duplicateNode.record_id
        );
      } else if (isConnectionSuggestion(currentSuggestion)) {
        await acceptConnectionSuggestion(
          currentInvestigation.record_id,
          currentSuggestion.fromNode.record_id,
          currentSuggestion.toNode.record_id,
          currentSuggestion.relationshipType,
          currentSuggestion.relationshipLabel
        );
      }

      // Reload investigation to reflect changes
      await loadInvestigation(currentInvestigation.record_id);

      setState(prev => ({
        ...prev,
        status: 'ready',
        accepted: prev.accepted + 1,
      }));

      moveToNext();
    } catch (err) {
      setState(prev => ({
        ...prev,
        status: 'ready',
        error: err instanceof Error ? err.message : 'Failed to accept suggestion',
      }));
    }
  }, [currentInvestigation, currentSuggestion, loadInvestigation, moveToNext]);

  const handleSkip = useCallback(() => {
    setState(prev => ({
      ...prev,
      skipped: prev.skipped + 1,
      error: undefined, // Clear any error when skipping
    }));
    moveToNext();
  }, [moveToNext]);

  const handleStop = useCallback(() => {
    setState(prev => ({ ...prev, status: 'complete' }));
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-space-800 rounded-xl shadow-2xl border border-space-600 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-space-600 bg-space-750">
          <div className="flex items-center gap-3">
            <Sparkles size={24} className="text-accent" />
            <div>
              <h2 className="text-lg font-semibold text-space-100">Find Duplicates & Connections</h2>
              <p className="text-xs text-space-400">AI-powered analysis of your canvas</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-space-600 transition-colors"
            title="Close"
          >
            <X size={20} className="text-space-300" />
          </button>
        </div>

        {/* Progress bar (only in ready state) */}
        {state.status === 'ready' && state.suggestions.length > 0 && (
          <div className="px-6 py-3 bg-space-750 border-b border-space-600">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-space-400">
                Suggestion {state.currentIndex + 1} of {state.suggestions.length}
              </span>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-green-400">{state.accepted} accepted</span>
                <span className="text-space-400">{state.skipped} skipped</span>
              </div>
            </div>
            <div className="h-1.5 bg-space-600 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Loading State */}
          {state.status === 'loading' && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 size={48} className="text-accent animate-spin mb-4" />
              <p className="text-space-200 font-medium">Analyzing your canvas...</p>
              <p className="text-sm text-space-400 mt-1">Looking for duplicates and missing connections</p>
            </div>
          )}

          {/* Error State */}
          {state.status === 'error' && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                <AlertCircle size={32} className="text-red-400" />
              </div>
              <p className="text-red-400 font-medium mb-2">Analysis Failed</p>
              <p className="text-sm text-space-400 text-center mb-4">{state.error}</p>
              <button
                onClick={startAnalysis}
                className="px-4 py-2 bg-space-700 hover:bg-space-600 rounded-lg text-sm font-medium transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Empty State */}
          {state.status === 'empty' && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                <CheckCircle2 size={32} className="text-green-400" />
              </div>
              <p className="text-space-100 font-medium mb-2">All Clear!</p>
              <p className="text-sm text-space-400 text-center">
                No duplicate entities or missing connections were found on your canvas.
              </p>
            </div>
          )}

          {/* Processing State */}
          {state.status === 'processing' && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 size={48} className="text-accent animate-spin mb-4" />
              <p className="text-space-200 font-medium">Applying changes...</p>
            </div>
          )}

          {/* Ready State - Show current suggestion */}
          {state.status === 'ready' && currentSuggestion && (
            <>
              {/* Error banner */}
              {state.error && (
                <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-red-300">{state.error}</p>
                  </div>
                  <button
                    onClick={() => setState(prev => ({ ...prev, error: undefined }))}
                    className="text-red-400 hover:text-red-300 p-0.5"
                    title="Dismiss"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {isDuplicateSuggestion(currentSuggestion) && (
                <DuplicateSuggestionView suggestion={currentSuggestion} />
              )}
              {isConnectionSuggestion(currentSuggestion) && (
                <ConnectionSuggestionView suggestion={currentSuggestion} />
              )}
            </>
          )}

          {/* Complete State */}
          {state.status === 'complete' && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mb-4">
                <PartyPopper size={32} className="text-accent" />
              </div>
              <p className="text-space-100 font-medium mb-2">All Done!</p>
              <p className="text-sm text-space-400 text-center mb-6">
                You've reviewed all {state.suggestions.length} suggestion{state.suggestions.length !== 1 ? 's' : ''}.
              </p>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">{state.accepted}</div>
                  <div className="text-xs text-space-400">Accepted</div>
                </div>
                <div className="w-px h-10 bg-space-600" />
                <div className="text-center">
                  <div className="text-2xl font-bold text-space-400">{state.skipped}</div>
                  <div className="text-xs text-space-400">Skipped</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {state.status === 'ready' && currentSuggestion && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-space-600 bg-space-750">
            <button
              onClick={handleStop}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-space-300 hover:text-space-100 hover:bg-space-600 rounded-lg transition-colors"
            >
              <Square size={16} />
              Stop
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSkip}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-space-300 bg-space-700 hover:bg-space-600 rounded-lg transition-colors"
              >
                <SkipForward size={16} />
                Skip
              </button>
              <button
                onClick={handleAccept}
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-accent hover:bg-accent/90 rounded-lg transition-colors"
              >
                <CheckCircle2 size={16} />
                Accept
              </button>
            </div>
          </div>
        )}

        {/* Close button for complete/empty/error states */}
        {(state.status === 'complete' || state.status === 'empty' || state.status === 'error') && (
          <div className="flex items-center justify-center px-6 py-4 border-t border-space-600 bg-space-750">
            <button
              onClick={onClose}
              className="px-6 py-2 text-sm font-medium bg-accent hover:bg-accent/90 text-white rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
