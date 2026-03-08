import React, { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppState, AppStateStatus } from 'react-native';
import Toast from 'react-native-toast-message';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { useTrackerStore } from './store/trackerStore';

const queryClient = new QueryClient();

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://nba-live-tracker-1.preview.emergentagent.com';

function AppContent() {
  const socketRef = useRef<Socket | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const { setConnected, handleNewScore, handlePlayerAction, handleSubstitution, setGames } = useTrackerStore();

  // Function to connect socket
  const connectSocket = () => {
    if (socketRef.current?.connected) return;
    
    const socketUrl = API_URL;
    console.log('🔌 Connecting socket to:', socketUrl);
    
    const socket = io(socketUrl, {
      transports: ['polling'],
      path: '/api/socket.io',
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      forceNew: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ Socket connected, ID:', socket.id);
      setConnected(true);
    });

    socket.on('connect_error', (error) => {
      console.log('❌ Socket connection error:', error.message);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
      setConnected(false);
    });

    socket.on('new_score', (data) => {
      // Get fresh state to check tracked players
      const currentState = useTrackerStore.getState();
      console.log('🏀 Score event:', data.player_name, data.total_points, 'PTS');
      console.log('🎯 Tracked players:', currentState.trackedPlayers);
      handleNewScore(data);
    });

    socket.on('player_action', (data) => {
      handlePlayerAction(data);
    });

    socket.on('player_substitution', (data) => {
      // Get fresh state to check tracked players
      const currentState = useTrackerStore.getState();
      console.log('🔄 Substitution event:', data.player_name, data.sub_status);
      console.log('🎯 Tracked players:', currentState.trackedPlayers);
      handleSubstitution(data);
    });

    socket.on('games_update', (data) => {
      if (data.games) {
        setGames(data.games);
      }
    });
  };

  useEffect(() => {
    // Initial socket connection
    connectSocket();

    // Handle app state changes (foreground/background)
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      console.log('📱 App state changed:', appStateRef.current, '->', nextAppState);
      
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground - reconnect socket if needed
        console.log('📱 App came to foreground, reconnecting socket...');
        if (!socketRef.current?.connected) {
          connectSocket();
        }
      }
      
      appStateRef.current = nextAppState;
    });

    return () => {
      console.log('🔌 Cleaning up socket connection');
      subscription.remove();
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: '#1a1a2e',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen 
          name="index" 
          options={{ 
            headerShown: false,
          }} 
        />
        <Stack.Screen 
          name="game/[id]" 
          options={{ 
            title: 'Game Details',
          }} 
        />
        <Stack.Screen 
          name="tracked" 
          options={{ 
            title: 'Tracked Players',
            presentation: 'modal',
          }} 
        />
      </Stack>
      <Toast />
    </>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AppContent />
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
