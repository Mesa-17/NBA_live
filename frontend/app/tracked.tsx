import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTrackerStore } from './store/trackerStore';

export default function TrackedPlayersScreen() {
  const { trackedPlayers, playerStats, playerSubStatus, removeTrackedPlayer } = useTrackerStore();

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {trackedPlayers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={64} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>No Players Tracked</Text>
            <Text style={styles.emptySubtitle}>
              Go to a game and tap the bell icon next to a player to start tracking their stats.
            </Text>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backButtonText}>Browse Games</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>
              Tracking {trackedPlayers.length} player{trackedPlayers.length > 1 ? 's' : ''}
            </Text>
            {trackedPlayers.map((player) => {
              const stats = playerStats[player] || { pts: 0, reb: 0, ast: 0 };
              const subStatus = playerSubStatus[player] || 'in';
              
              return (
                <View key={player} style={styles.playerCard}>
                  <View style={styles.playerHeader}>
                    <View style={styles.playerNameRow}>
                      <Text style={styles.playerName}>{player}</Text>
                      {subStatus === 'in' ? (
                        <View style={styles.statusBadge}>
                          <Ionicons name="basketball" size={12} color="#10b981" />
                          <Text style={styles.statusIn}>In Game</Text>
                        </View>
                      ) : (
                        <View style={[styles.statusBadge, styles.statusBadgeOut]}>
                          <Ionicons name="caret-down" size={12} color="#ef4444" />
                          <Text style={styles.statusOut}>Benched</Text>
                        </View>
                      )}
                    </View>
                    <TouchableOpacity 
                      style={styles.removeButton}
                      onPress={() => removeTrackedPlayer(player)}
                    >
                      <Ionicons name="close" size={20} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                      <Text style={styles.statLabel}>POINTS</Text>
                      <Text style={styles.statValue}>{stats.pts}</Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={styles.statLabel}>REBOUNDS</Text>
                      <Text style={styles.statValue}>{stats.reb}</Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={styles.statLabel}>ASSISTS</Text>
                      <Text style={styles.statValue}>{stats.ast}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#374151',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 22,
  },
  backButton: {
    marginTop: 24,
    backgroundColor: '#667eea',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 16,
  },
  playerCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  playerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  playerNameRow: {
    flex: 1,
  },
  playerName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
    alignSelf: 'flex-start',
  },
  statusBadgeOut: {
    backgroundColor: '#fef2f2',
  },
  statusIn: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16a34a',
  },
  statusOut: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ef4444',
  },
  removeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#667eea',
  },
});
