import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
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
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
