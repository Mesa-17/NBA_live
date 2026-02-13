import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Drawer } from 'expo-router/drawer';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
import Toast from 'react-native-toast-message';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTrackerStore } from './store/trackerStore';

const queryClient = new QueryClient();

function CustomDrawerContent(props: any) {
  const { trackedPlayers, playerStats, playerSubStatus, removeTrackedPlayer } = useTrackerStore();

  return (
    <SafeAreaView style={styles.drawerContainer}>
      <View style={styles.drawerHeader}>
        <Ionicons name="basketball" size={32} color="#fff" />
        <Text style={styles.drawerTitle}>NBA Tracker</Text>
      </View>
      
      <DrawerContentScrollView {...props} contentContainerStyle={styles.drawerContent}>
        <DrawerItemList {...props} />
        
        <View style={styles.trackedSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="notifications" size={20} color="#667eea" />
            <Text style={styles.sectionTitle}>Tracked Players</Text>
          </View>
          
          {trackedPlayers.length === 0 ? (
            <Text style={styles.noPlayersText}>No players tracked yet.{"\n"}Tap the bell icon next to a player to start tracking.</Text>
          ) : (
            <ScrollView style={styles.trackedList}>
              {trackedPlayers.map((player) => {
                const stats = playerStats[player] || { pts: 0, reb: 0, ast: 0 };
                const subStatus = playerSubStatus[player] || 'in';
                
                return (
                  <View key={player} style={styles.trackedPlayerCard}>
                    <View style={styles.playerHeader}>
                      <View style={styles.playerNameRow}>
                        <Text style={styles.playerName}>{player}</Text>
                        {subStatus === 'in' ? (
                          <Ionicons name="basketball" size={14} color="#10b981" />
                        ) : (
                          <Ionicons name="caret-down" size={14} color="#ef4444" />
                        )}
                      </View>
                      <TouchableOpacity onPress={() => removeTrackedPlayer(player)}>
                        <Ionicons name="close-circle" size={20} color="#9ca3af" />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.statsRow}>
                      <View style={styles.statBox}>
                        <Text style={styles.statLabel}>PTS</Text>
                        <Text style={styles.statValue}>{stats.pts}</Text>
                      </View>
                      <View style={styles.statBox}>
                        <Text style={styles.statLabel}>REB</Text>
                        <Text style={styles.statValue}>{stats.reb}</Text>
                      </View>
                      <View style={styles.statBox}>
                        <Text style={styles.statLabel}>AST</Text>
                        <Text style={styles.statValue}>{stats.ast}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </DrawerContentScrollView>
    </SafeAreaView>
  );
}

export default function Layout() {
  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="light" />
        <Drawer
          drawerContent={(props) => <CustomDrawerContent {...props} />}
          screenOptions={{
            headerStyle: {
              backgroundColor: '#667eea',
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
            drawerStyle: {
              backgroundColor: '#f8fafc',
              width: 320,
            },
            drawerActiveTintColor: '#667eea',
            drawerInactiveTintColor: '#64748b',
            drawerLabelStyle: {
              fontSize: 16,
              fontWeight: '600',
            },
          }}
        >
          <Drawer.Screen
            name="index"
            options={{
              title: 'NBA Live Tracker',
              drawerLabel: 'Games',
              drawerIcon: ({ color, size }) => (
                <Ionicons name="basketball-outline" size={size} color={color} />
              ),
            }}
          />
          <Drawer.Screen
            name="game/[id]"
            options={{
              title: 'Game Details',
              drawerItemStyle: { display: 'none' },
            }}
          />
        </Drawer>
        <Toast />
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  drawerContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 10,
    backgroundColor: '#667eea',
    gap: 12,
  },
  drawerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  drawerContent: {
    paddingTop: 10,
  },
  trackedSection: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  noPlayersText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    paddingVertical: 20,
    lineHeight: 20,
  },
  trackedList: {
    maxHeight: 400,
  },
  trackedPlayerCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  playerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  playerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#667eea',
  },
});
