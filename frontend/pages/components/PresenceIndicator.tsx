import { memo } from 'react';
import { useInvestigationsStore } from '@/modules/investigations/store';
import { Users } from 'lucide-react';

export const PresenceIndicator = memo(function PresenceIndicator() {
  const { onlineUsers } = useInvestigationsStore();

  if (onlineUsers.length === 0) {
    return (
      <div className="flex items-center gap-2 text-space-400">
        <Users size={16} />
        <span className="text-sm">Just you</span>
      </div>
    );
  }

  // Show up to 3 avatars, then a count
  const displayUsers = onlineUsers.slice(0, 3);
  const remainingCount = onlineUsers.length - 3;

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {displayUsers.map((user) => (
          <div
            key={user.userId}
            className="w-7 h-7 rounded-full border-2 border-space-800 flex items-center justify-center text-xs font-medium"
            style={{ backgroundColor: user.color }}
            title={user.username}
          >
            {user.username.charAt(0).toUpperCase()}
          </div>
        ))}
        {remainingCount > 0 && (
          <div
            className="w-7 h-7 rounded-full border-2 border-space-800 bg-space-600 flex items-center justify-center text-xs font-medium"
            title={`${remainingCount} more users`}
          >
            +{remainingCount}
          </div>
        )}
      </div>
      <span className="text-sm text-space-300">
        {onlineUsers.length + 1} online
      </span>
    </div>
  );
});
