import { useEffect, useState } from 'react';
import { wsService } from '@services/websocket-service';

export const useWebSocket = () => {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const connect = async () => {
      try {
        await wsService.connect();
        setIsConnected(true);
      } catch (error) {
        console.error('WebSocket connection failed:', error);
        setIsConnected(false);
      }
    };

    connect();

    return () => {
      wsService.disconnect();
      setIsConnected(false);
    };
  }, []);

  return {
    isConnected,
    subscribe: wsService.subscribe.bind(wsService),
    unsubscribe: wsService.unsubscribe.bind(wsService),
  };
};
