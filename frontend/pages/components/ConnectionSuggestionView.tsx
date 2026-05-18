import { Link2, Database, Sparkles, ArrowRight } from 'lucide-react';
import { NodePreviewCard } from './NodePreviewCard';
import type { ConnectionSuggestion } from '@/modules/investigations/types';

interface ConnectionSuggestionViewProps {
  suggestion: ConnectionSuggestion;
}

export function ConnectionSuggestionView({ suggestion }: ConnectionSuggestionViewProps) {
  const isDatabase = suggestion.type === 'database_connection';
  const confidencePercent = Math.round(suggestion.confidence * 100);

  return (
    <div className="space-y-4">
      {/* Type badge and confidence */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isDatabase ? (
            <Database size={16} className="text-green-400" />
          ) : (
            <Sparkles size={16} className="text-purple-400" />
          )}
          <span className={`text-xs font-medium ${isDatabase ? 'text-green-400' : 'text-purple-400'}`}>
            {isDatabase ? 'Known Relationship' : 'AI Suggested'}
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

      {/* Connection visualization */}
      <div className="space-y-3">
        {/* From node */}
        <NodePreviewCard node={suggestion.fromNode} />

        {/* Connection arrow with label */}
        <div className="flex items-center gap-3 px-4">
          <div className="flex-1 h-px bg-gradient-to-r from-space-600 to-accent/50" />
          <div className="flex items-center gap-2 bg-space-700 px-3 py-1.5 rounded-full border border-space-600">
            <Link2 size={14} className="text-accent" />
            <span className="text-xs font-medium text-space-100">{suggestion.relationshipLabel}</span>
            <ArrowRight size={14} className="text-space-400" />
          </div>
          <div className="flex-1 h-px bg-gradient-to-l from-space-600 to-accent/50" />
        </div>

        {/* To node */}
        <NodePreviewCard node={suggestion.toNode} />
      </div>

      {/* Connection details */}
      <div className="bg-space-750 rounded-lg p-3 border border-space-600">
        <h4 className="text-xs font-medium text-space-400 mb-2">Connection Details</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-space-400">Type:</span>
            <span className="ml-2 text-space-200">{suggestion.relationshipType}</span>
          </div>
          <div>
            <span className="text-space-400">Label:</span>
            <span className="ml-2 text-space-200">{suggestion.relationshipLabel}</span>
          </div>
        </div>
      </div>

      {/* What will happen */}
      <div className="bg-space-750 rounded-lg p-3 border border-space-600">
        <h4 className="text-xs font-medium text-space-400 mb-2">What happens when you accept:</h4>
        <ul className="text-xs text-space-300 space-y-1">
          <li className="flex items-start gap-2">
            <span className="text-green-400">•</span>
            <span>A new connection will be created between these two nodes</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent">•</span>
            <span>The connection will be labeled <strong className="text-space-100">"{suggestion.relationshipLabel}"</strong></span>
          </li>
        </ul>
      </div>
    </div>
  );
}
