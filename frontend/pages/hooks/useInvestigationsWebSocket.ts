import { useEffect, useRef, useCallback, useState } from 'react';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { useInvestigationsStore } from '@/modules/investigations/store';
import { getPartitionId } from '@/api/client';
import { getWebSocketToken } from '@/api/websocket.api';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';
import type {
  InvestigationNode,
  InvestigationConnection,
  InvestigationDrawing,
  CanvasState,
} from '@/modules/investigations/types';

// Connection state type
type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

// Declare Pusher on window for Laravel Echo
declare global {
  interface Window {
    Pusher: typeof Pusher;
    Echo: Echo<'reverb'>;
  }
}

// Initialize Pusher globally
if (typeof window !== 'undefined') {
  window.Pusher = Pusher;
}

// Throttle helper for cursor updates
function throttle<T extends (...args: never[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let lastFunc: ReturnType<typeof setTimeout>;
  let lastRan: number;
  return function (this: unknown, ...args: Parameters<T>) {
    if (!lastRan) {
      func.apply(this, args);
      lastRan = Date.now();
    } else {
      clearTimeout(lastFunc);
      lastFunc = setTimeout(() => {
        if (Date.now() - lastRan >= limit) {
          func.apply(this, args);
          lastRan = Date.now();
        }
      }, limit - (Date.now() - lastRan));
    }
  };
}

export const useInvestigationsWebSocket = (investigationId: string | null) => {
  const echoRef = useRef<Echo<'reverb'> | null>(null);
  const currentChannelRef = useRef<string | null>(null);
  const isSubscribingRef = useRef(false);
  const wasConnectedRef = useRef(false);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // FE-CRIT-002: Track initialization and token refresh
  const isInitializingRef = useRef(false);
  const wsTokenRef = useRef<string | null>(null);
  // Ref for subscribe so reconnection handler can call it without closure issues
  const subscribeRef = useRef<(invId: string) => Promise<void>>(async () => {});
  const tokenRefreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Determine if we're in production (enforce WSS)
  const isProduction = import.meta.env.MODE === 'production' ||
    import.meta.env.VITE_REVERB_SCHEME === 'https';

  // Track connection state
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');

  const { user } = useAuthStore();

  const {
    handleNodeAdded,
    handleNodeMoved,
    handleNodeUpdated,
    handleNodeRemoved,
    handleConnectionAdded,
    handleConnectionUpdated,
    handleConnectionRemoved,
    handleDrawingAdded,
    handleDrawingUpdated,
    handleDrawingRemoved,
    handleUserJoined,
    handleUserLeft,
    handleCursorMoved,
    handleCanvasStateUpdated,
    refreshGraphData,
  } = useInvestigationsStore();

  // Use refs for stable references
  const handlersRef = useRef({
    handleNodeAdded,
    handleNodeMoved,
    handleNodeUpdated,
    handleNodeRemoved,
    handleConnectionAdded,
    handleConnectionUpdated,
    handleConnectionRemoved,
    handleDrawingAdded,
    handleDrawingUpdated,
    handleDrawingRemoved,
    handleUserJoined,
    handleUserLeft,
    handleCursorMoved,
    handleCanvasStateUpdated,
    refreshGraphData,
  });
  handlersRef.current = {
    handleNodeAdded,
    handleNodeMoved,
    handleNodeUpdated,
    handleNodeRemoved,
    handleConnectionAdded,
    handleConnectionUpdated,
    handleConnectionRemoved,
    handleDrawingAdded,
    handleDrawingUpdated,
    handleDrawingRemoved,
    handleUserJoined,
    handleUserLeft,
    handleCursorMoved,
    handleCanvasStateUpdated,
    refreshGraphData,
  };

  // Handle reconnection - refresh WS token and state from server
  const handleReconnection = useCallback(() => {
    const invId = currentChannelRef.current;
    if (!invId || !wasConnectedRef.current) return;

    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    // Debounce reconnection handling to avoid multiple rapid refreshes
    reconnectTimeoutRef.current = setTimeout(async () => {
      try {
        // Refresh WS token so channel re-auth succeeds (critical on native where no cookie fallback)
        const { ws_token: freshToken } = await getWebSocketToken();
        wsTokenRef.current = freshToken;
        if (echoRef.current?.options?.auth?.headers) {
          echoRef.current.options.auth.headers['X-WS-Token'] = freshToken;
        }

        // Re-subscribe channel with fresh token (Pusher's auto re-auth already failed with stale token)
        if (invId && echoRef.current) {
          if (channelRef.current) {
            channelRef.current.stopListening('.node.added');
            channelRef.current.stopListening('.node.moved');
            channelRef.current.stopListening('.node.updated');
            channelRef.current.stopListening('.node.removed');
            channelRef.current.stopListening('.connection.added');
            channelRef.current.stopListening('.connection.updated');
            channelRef.current.stopListening('.connection.removed');
            channelRef.current.stopListening('.drawing.added');
            channelRef.current.stopListening('.drawing.updated');
            channelRef.current.stopListening('.drawing.removed');
            channelRef.current.stopListening('.user.joined');
            channelRef.current.stopListening('.user.left');
            channelRef.current.stopListening('.canvas.state.updated');
            channelRef.current = null;
          }
          echoRef.current.leave(`investigation.canvas.${invId}`);
          currentChannelRef.current = null;
          isSubscribingRef.current = false;
          subscribeRef.current(invId);
        }
      } catch {
        // Token refresh failed - channel re-auth may still work via JWT cookie on web
      }

      toast.info('Reconnected. Syncing changes...');

      try {
        // Refresh full graph state from server to reconcile any missed updates
        await handlersRef.current.refreshGraphData();
        toast.success('Canvas synced successfully');
      } catch {
        toast.error('Failed to sync canvas. Please refresh the page.');
      }
    }, 500);
  }, []);

  // Initialize Echo connection with short-lived WS token
  const initializeEcho = useCallback(async () => {
    if (echoRef.current || isInitializingRef.current) return;
    isInitializingRef.current = true;

    const partitionId = getPartitionId();

    try {
      setConnectionState('connecting');

      // FE-CRIT-002: Get short-lived WebSocket token instead of using JWT
      const { ws_token } = await getWebSocketToken();
      wsTokenRef.current = ws_token;

      echoRef.current = new Echo({
        broadcaster: 'reverb',
        key: import.meta.env.VITE_REVERB_APP_KEY || 'app-key',
        wsHost: import.meta.env.VITE_REVERB_HOST || window.location.hostname,
        wsPort: import.meta.env.VITE_REVERB_PORT || 8080,
        wssPort: import.meta.env.VITE_REVERB_PORT || 443,
        forceTLS: isProduction,
        // Use 'ws' transport - forceTLS ensures it uses WSS on wssPort
        enabledTransports: ['ws', 'wss'],
        authEndpoint: `${import.meta.env.VITE_API_BASE_URL || '/api'}/broadcasting/auth`,
        auth: {
          headers: {
            // FE-CRIT-002: Use short-lived WS token instead of JWT
            'X-WS-Token': ws_token,
            'X-Partition-ID': partitionId || '',
          },
        },
      });

      // FE-CRIT-002: Set up token refresh for long-running connections
      tokenRefreshIntervalRef.current = setInterval(async () => {
        try {
          const { ws_token: newToken } = await getWebSocketToken();
          wsTokenRef.current = newToken;
          if (echoRef.current?.options?.auth?.headers) {
            echoRef.current.options.auth.headers['X-WS-Token'] = newToken;
          }
        } catch {
          // Token refresh failed - will get a new token on next subscription
        }
      }, 3 * 60 * 1000);

      // Monitor connection state changes via Pusher
      const pusher = echoRef.current.connector?.pusher;
      if (pusher) {
        pusher.connection.bind('state_change', (states: { previous: string; current: string }) => {
          const { previous, current } = states;

          // Update connection state
          if (current === 'connected') {
            setConnectionState('connected');

            // If we were previously connected and are now reconnecting, trigger reconciliation
            if (wasConnectedRef.current && (previous === 'unavailable' || previous === 'connecting')) {
              handleReconnection();
            }

            wasConnectedRef.current = true;
          } else if (current === 'connecting') {
            setConnectionState(wasConnectedRef.current ? 'reconnecting' : 'connecting');
          } else if (current === 'unavailable' || current === 'failed') {
            setConnectionState('disconnected');
          }
        });

        // Handle connection errors
        pusher.connection.bind('error', () => {
          setConnectionState('disconnected');
        });
      }

      window.Echo = echoRef.current;
    } catch {
      console.error('Failed to initialize Echo');
      setConnectionState('disconnected');
    } finally {
      isInitializingRef.current = false;
    }
  }, [handleReconnection, isProduction]);

  // Track channel reference for proper cleanup
  const channelRef = useRef<ReturnType<Echo<'reverb'>['join']> | null>(null);

  // Subscribe to investigation canvas channel
  const subscribe = useCallback(
    async (invId: string) => {
      // Atomic check-and-set to prevent race condition
      if (isSubscribingRef.current) {
        return;
      }
      // Set flag immediately to prevent concurrent subscriptions
      isSubscribingRef.current = true;

      // Already subscribed to this channel
      if (currentChannelRef.current === invId) {
        isSubscribingRef.current = false;
        return;
      }

      try {
        // Initialize Echo if needed (now async)
        if (!echoRef.current) {
          await initializeEcho();
        }

        const echo = echoRef.current;
        if (!echo) {
          isSubscribingRef.current = false;
          return;
        }

      // Unsubscribe from previous channel and clean up listeners
      if (currentChannelRef.current && currentChannelRef.current !== invId) {
        if (channelRef.current) {
          // Stop listening to all events before leaving
          channelRef.current.stopListening('.node.added');
          channelRef.current.stopListening('.node.moved');
          channelRef.current.stopListening('.node.updated');
          channelRef.current.stopListening('.node.removed');
          channelRef.current.stopListening('.connection.added');
          channelRef.current.stopListening('.connection.updated');
          channelRef.current.stopListening('.connection.removed');
          channelRef.current.stopListening('.drawing.added');
          channelRef.current.stopListening('.drawing.updated');
          channelRef.current.stopListening('.drawing.removed');
          channelRef.current.stopListening('.user.joined');
          channelRef.current.stopListening('.user.left');
          channelRef.current.stopListening('.canvas.state.updated');
          channelRef.current = null;
        }
        echo.leave(`investigation.canvas.${currentChannelRef.current}`);
        currentChannelRef.current = null;
      }

      currentChannelRef.current = invId;
      const currentUserId = user?.record_id;

      // Join the investigation canvas presence channel
      const channel = echo.join(`investigation.canvas.${invId}`);
      channelRef.current = channel;

      // Node events
      channel.listen('.node.added', (event: { node: InvestigationNode; user_id: string }) => {
        if (event.user_id !== currentUserId) {
          handlersRef.current.handleNodeAdded(event.node, event.user_id);
        }
      });

      channel.listen('.node.moved', (event: { node_id: string; x: number; y: number; z_index: number | null; user_id: string }) => {
        if (event.user_id !== currentUserId) {
          handlersRef.current.handleNodeMoved(event.node_id, event.x, event.y, event.z_index, event.user_id);
        }
      });

      channel.listen('.node.updated', (event: { node: InvestigationNode; user_id: string }) => {
        if (event.user_id !== currentUserId) {
          handlersRef.current.handleNodeUpdated(event.node, event.user_id);
        }
      });

      channel.listen('.node.removed', (event: { node_id: string; user_id: string }) => {
        if (event.user_id !== currentUserId) {
          handlersRef.current.handleNodeRemoved(event.node_id, event.user_id);
        }
      });

      // Connection events
      channel.listen('.connection.added', (event: { connection: InvestigationConnection; user_id: string }) => {
        if (event.user_id !== currentUserId) {
          handlersRef.current.handleConnectionAdded(event.connection, event.user_id);
        }
      });

      channel.listen('.connection.updated', (event: { connection: InvestigationConnection; user_id: string }) => {
        if (event.user_id !== currentUserId) {
          handlersRef.current.handleConnectionUpdated(event.connection, event.user_id);
        }
      });

      channel.listen('.connection.removed', (event: { connection_id: string; user_id: string }) => {
        if (event.user_id !== currentUserId) {
          handlersRef.current.handleConnectionRemoved(event.connection_id, event.user_id);
        }
      });

      // Drawing events
      channel.listen('.drawing.added', (event: { drawing: InvestigationDrawing; user_id: string }) => {
        if (event.user_id !== currentUserId) {
          handlersRef.current.handleDrawingAdded(event.drawing, event.user_id);
        }
      });

      channel.listen('.drawing.updated', (event: { drawing: InvestigationDrawing; user_id: string }) => {
        if (event.user_id !== currentUserId) {
          handlersRef.current.handleDrawingUpdated(event.drawing, event.user_id);
        }
      });

      channel.listen('.drawing.removed', (event: { drawing_id: string; user_id: string }) => {
        if (event.user_id !== currentUserId) {
          handlersRef.current.handleDrawingRemoved(event.drawing_id, event.user_id);
        }
      });

      // Presence events
      channel.listen('.user.joined', (event: { user_id: string; username: string }) => {
        if (event.user_id !== currentUserId) {
          handlersRef.current.handleUserJoined({ userId: event.user_id, username: event.username });
        }
      });

      channel.listen('.user.left', (event: { user_id: string }) => {
        handlersRef.current.handleUserLeft(event.user_id);
      });

      // Canvas state sync
      channel.listen('.canvas.state.updated', (event: { canvas_state: CanvasState; user_id: string }) => {
        if (event.user_id !== currentUserId) {
          handlersRef.current.handleCanvasStateUpdated(event.canvas_state, event.user_id);
        }
      });

      // Whisper for cursor position (lightweight, not persisted)
      channel.listenForWhisper('cursor', (event: { user_id: string; x: number; y: number }) => {
        if (event.user_id !== currentUserId) {
          handlersRef.current.handleCursorMoved(event.user_id, { x: event.x, y: event.y });
        }
      });
      } finally {
        isSubscribingRef.current = false;
      }
    },
    [initializeEcho, user?.record_id]
  );

  // Keep ref current so reconnection handler can call it
  subscribeRef.current = subscribe;

  // Broadcast cursor position (throttled)
  const broadcastCursor = useCallback(
    throttle((x: number, y: number) => {
      const echo = echoRef.current;
      const channelId = currentChannelRef.current;
      if (!echo || !channelId || !user?.record_id) return;

      try {
        const channel = echo.join(`investigation.canvas.${channelId}`);
        channel.whisper('cursor', {
          user_id: user.record_id,
          x,
          y,
        });
      } catch {
        // Ignore whisper errors
      }
    }, 50),
    [user?.record_id]
  );

  // Disconnect
  const disconnect = useCallback(() => {
    isSubscribingRef.current = false;
    isInitializingRef.current = false;

    // FE-CRIT-002: Clear token refresh interval
    if (tokenRefreshIntervalRef.current) {
      clearInterval(tokenRefreshIntervalRef.current);
      tokenRefreshIntervalRef.current = null;
    }
    wsTokenRef.current = null;

    if (echoRef.current) {
      if (currentChannelRef.current) {
        echoRef.current.leave(`investigation.canvas.${currentChannelRef.current}`);
        currentChannelRef.current = null;
      }
      echoRef.current.disconnect();
      echoRef.current = null;
    }
  }, []);

  // Subscribe when investigation ID changes
  useEffect(() => {
    if (investigationId) {
      subscribe(investigationId);
    } else if (currentChannelRef.current) {
      if (echoRef.current) {
        echoRef.current.leave(`investigation.canvas.${currentChannelRef.current}`);
        currentChannelRef.current = null;
      }
    }
  }, [investigationId, subscribe]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear any pending reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      // FE-CRIT-002: Clear token refresh interval
      if (tokenRefreshIntervalRef.current) {
        clearInterval(tokenRefreshIntervalRef.current);
        tokenRefreshIntervalRef.current = null;
      }

      // Stop listening to all events before cleanup
      if (channelRef.current) {
        channelRef.current.stopListening('.node.added');
        channelRef.current.stopListening('.node.moved');
        channelRef.current.stopListening('.node.updated');
        channelRef.current.stopListening('.node.removed');
        channelRef.current.stopListening('.connection.added');
        channelRef.current.stopListening('.connection.updated');
        channelRef.current.stopListening('.connection.removed');
        channelRef.current.stopListening('.drawing.added');
        channelRef.current.stopListening('.drawing.updated');
        channelRef.current.stopListening('.drawing.removed');
        channelRef.current.stopListening('.user.joined');
        channelRef.current.stopListening('.user.left');
        channelRef.current.stopListening('.canvas.state.updated');
        channelRef.current = null;
      }
      if (echoRef.current) {
        if (currentChannelRef.current) {
          echoRef.current.leave(`investigation.canvas.${currentChannelRef.current}`);
        }
        echoRef.current.disconnect();
        echoRef.current = null;
      }

      // Reset connection state
      wasConnectedRef.current = false;
    };
  }, []);

  return {
    subscribe,
    disconnect,
    broadcastCursor,
    isConnected: !!echoRef.current,
    connectionState,
  };
};

export default useInvestigationsWebSocket;
