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
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useTrackerStore } from './store/trackerStore';

export default function TrackedPlayersScreen() {
  const { trackedPlayers, playerStats, playerSubStatus, removeTrackedPlayer } = useTrackerStore();

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {trackedPlayers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <LinearGradient colors={['#f0f4ff', '#e8edff']} style={styles.emptyIcon}>
              <Ionicons name="notifications-off-outline" size={48} color="#667eea" />
            </LinearGradient>
            <Text style={styles.emptyTitle}>No Players Tracked</Text>
            <Text style={styles.emptySubtitle}>
              Go to a game and tap the bell icon next to a player to start tracking their stats and receive notifications!
            </Text>
            <TouchableOpacity onPress={() => router.back()}>
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.backButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="basketball" size={18} color="#fff" />
                <Text style={styles.backButtonText}>Browse Games</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.headerCard}>
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.headerGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="notifications" size={24} color="#fff" />
                <View style={styles.headerContent}>
                  <Text style={styles.headerTitle}>Tracking {trackedPlayers.length} player{trackedPlayers.length > 1 ? 's' : ''}</Text>
                  <Text style={styles.headerSubtitle}>You'll get instant notifications when they score</Text>
                </View>
              </LinearGradient>
            </View>

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
                          <View style={styles.statusDotGreen} />
                          <Text style={styles.statusIn}>In Game</Text>
                        </View>
                      ) : (
                        <View style={[styles.statusBadge, styles.statusBadgeOut]}>
                          <View style={styles.statusDotRed} />
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
                    <LinearGradient
                      colors={['#f0f4ff', '#e8edff']}
                      style={styles.statBox}
                    >
                      <Text style={styles.statValue}>{stats.pts}</Text>
                      <Text style={styles.statLabel}>POINTS</Text>
                    </LinearGradient>
                    <LinearGradient
                      colors={['#f0f4ff', '#e8edff']}
                      style={styles.statBox}
                    >
                      <Text style={styles.statValue}>{stats.reb}</Text>
                      <Text style={styles.statLabel}>REBOUNDS</Text>
                    </LinearGradient>
                    <LinearGradient
                      colors={['#f0f4ff', '#e8edff']}
                      style={styles.statBox}
                    >
                      <Text style={styles.statValue}>{stats.ast}</Text>
                      <Text style={styles.statLabel}>ASSISTS</Text>
                    </LinearGradient>
                  </View>
                </View>
              );
            })}

            {/* Notification Sample Card */}
            <View style={styles.sampleCard}>
              <Text style={styles.sampleTitle}>Notification Preview</Text>
              <View style={styles.notificationSample}>
                <LinearGradient
                  colors={['#22c55e', '#16a34a']}
                  style={styles.notificationIcon}
                >
                  <Ionicons name="basketball" size={20} color="#fff" />
                </LinearGradient>
                <View style={styles.notificationContent}>
                  <Text style={styles.notificationTitle}>\ud83c\udfc0 Player Scores!</Text>
                  <Text style={styles.notificationBody}>[Player Name] scored a 3-pointer! (25 PTS)</Text>
                </View>
              </View>
              <Text style={styles.sampleNote}>Notifications appear both in-app and as push notifications on your device</Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
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
    paddingBottom: 30,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#374151',
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#9ca3af',
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 22,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 28,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 25,
    gap: 10,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  headerCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
  },
  headerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  playerCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  playerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  playerNameRow: {
    flex: 1,
  },
  playerName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 6,
    alignSelf: 'flex-start',
  },
  statusBadgeOut: {
    backgroundColor: '#fef2f2',
  },
  statusDotGreen: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  statusDotRed: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
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
    gap: 10,
  },
  statBox: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#667eea',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  sampleCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    marginTop: 10,
  },
  sampleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 14,
  },
  notificationSample: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 14,
  },
  notificationIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
  },
  notificationBody: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
  sampleNote: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 14,
    fontStyle: 'italic',
  },
});
