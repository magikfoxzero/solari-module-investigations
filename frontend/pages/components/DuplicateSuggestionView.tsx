import { Copy, ArrowRight, GitMerge, AlertTriangle } from 'lucide-react';
import { NodePreviewCard } from './NodePreviewCard';
import type { DuplicateSuggestion } from '@/modules/investigations/types';

interface DuplicateSuggestionViewProps {
  suggestion: DuplicateSuggestion;
}

export function DuplicateSuggestionView({ suggestion }: DuplicateSuggestionViewProps) {
  const isExact = suggestion.type === 'exact_duplicate';
  const confidencePercent = Math.round(suggestion.confidence * 100);

  return (
    <div className="space-y-4">
      {/* Type badge and confidence */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isExact ? (
            <Copy size={16} className="text-red-400" />
          ) : (
            <GitMerge size={16} className="text-orange-400" />
          )}
          <span className={`text-xs font-medium ${isExact ? 'text-red-400' : 'text-orange-400'}`}>
            {isExact ? 'Exact Duplicate' : 'Possible Duplicate'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-space-400">Confidence:</span>
          <span className={`text-sm font-bold ${
            confidencePercent >= 90 ? 'text-green-400' :
            confidencePercent >= 70 ? 'text-yellow-400' :
            'text-orange-400'
          }`}>
            {confidencePercent}%
          </span>
        </div>
      </div>

      {/* Reason */}
      <div className="bg-space-750 rounded-lg p-3 border border-space-600">
        <p className="text-sm text-space-200">{suggestion.reason}</p>
      </div>

      {/* Side by side comparison */}
      <div className="grid grid-cols-2 gap-4">
        {/* Keep node */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-green-400 uppercase tracking-wide">Keep</span>
          </div>
          <NodePreviewCard node={suggestion.keepNode} selected />
        </div>

        {/* Delete node */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-red-400 uppercase tracking-wide">Remove</span>
          </div>
          <NodePreviewCard node={suggestion.duplicateNode} />
        </div>
      </div>

      {/* Arrow indicator */}
      <div className="flex items-center justify-center gap-2 py-2">
        <div className="flex-1 h-px bg-space-600" />
        <ArrowRight size={20} className="text-space-400" />
        <div className="flex-1 h-px bg-space-600" />
      </div>

      {/* Connection transfer notice */}
      {suggestion.connectionCount > 0 && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-blue-300">
            <span className="font-medium">{suggestion.connectionCount}</span> connection{suggestion.connectionCount !== 1 ? 's' : ''} will be transferred from the removed node to the kept node.
          </div>
        </div>
      )}

      {/* What will happen */}
      <div className="bg-space-750 rounded-lg p-3 border border-space-600">
        <h4 className="text-xs font-medium text-space-400 mb-2">What happens when you accept:</h4>
        <ul className="text-xs text-space-300 space-y-1">
          <li className="flex items-start gap-2">
            <span className="text-green-400">•</span>
            <span>The <strong className="text-space-100">"{suggestion.keepNode.display_label}"</strong> node stays on the canvas</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-red-400">•</span>
            <span>The <strong className="text-space-100">"{suggestion.duplicateNode.display_label}"</strong> node is removed</span>
          </li>
          {suggestion.connectionCount > 0 && (
            <li className="flex items-start gap-2">
              <span className="text-blue-400">•</span>
              <span>All {suggestion.connectionCount} connection{suggestion.connectionCount !== 1 ? 's' : ''} from the removed node will be moved to the kept node</span>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
