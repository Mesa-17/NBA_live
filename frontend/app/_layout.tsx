import React, { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { useTrackerStore } from './store/trackerStore';

const queryClient = new QueryClient();

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://court-watch.preview.emergentagent.com';

function AppContent() {
  const socketRef = useRef<Socket | null>(null);
  const { setConnected, handleNewScore, handlePlayerAction, setGames, trackedPlayers } = useTrackerStore();

  useEffect(() => {
    // Connect to socket for real-time notifications - persists across all screens
    const socketUrl = API_URL;
    console.log('🔌 Root layout connecting socket to:', socketUrl);
    
    const socket = io(socketUrl, {
      transports: ['polling'],  // Use polling only due to K8s ingress limitations
      path: '/api/socket.io',
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      forceNew: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ Socket connected in root layout, ID:', socket.id);
      setConnected(true);
    });

    socket.on('connect_error', (error) => {
      console.log('❌ Socket connection error:', error.message);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
      setConnected(false);
    });

    // Listen for real-time score events - works on ALL pages
    socket.on('new_score', (data) => {
      console.log('🏀 ROOT: Received new_score event:', data.player_name, data.total_points, 'PTS');
      console.log('🎯 Currently tracked players:', trackedPlayers);
      handleNewScore(data);
    });

    socket.on('player_action', (data) => {
      handlePlayerAction(data);
    });

    socket.on('games_update', (data) => {
      if (data.games) {
        setGames(data.games);
      }
    });

    return () => {
      console.log('🔌 Cleaning up socket connection');
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
            backgroundColor: '#667eea',
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
            title: 'NBA Live Tracker',
            headerShown: true,
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
