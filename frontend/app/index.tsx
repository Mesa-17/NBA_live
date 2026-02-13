import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  ActivityIndicator,
  Animated,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import Toast from 'react-native-toast-message';
import { useTrackerStore } from './store/trackerStore';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://sleek-ios-hub.preview.emergentagent.com';

export default function GamesScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  const {
    connected,
    games,
    trackedPlayers,
    setConnected,
    setGames,
    setPushToken,
  } = useTrackerStore();

  // Pulse animation for live indicator
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const registerForPushNotifications = async () => {
    if (!Device.isDevice) return;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return;

    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      if (projectId) {
        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        setPushToken(tokenData.data);
      }
    } catch (error) {
      console.log('Error getting push token:', error);
    }
  };

  const fetchGames = async () => {
    try {
      const response = await fetch(`${API_URL}/api/games`);
      const data = await response.json();
      setGames(data.games || []);
      setLoading(false);
      setConnected(true);
    } catch (error) {
      console.log('Error fetching games:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    registerForPushNotifications();
    fetchGames();
    
    // Real-time polling every 5 seconds for live updates
    const pollInterval = setInterval(() => {
      fetchGames();
    }, 5000);

    return () => clearInterval(pollInterval);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchGames();
    setRefreshing(false);
  };

  // Demo notification function
  const showDemoNotification = async () => {
    // Show in-app toast
    Toast.show({
      type: 'success',
      text1: '\ud83c\udfc0 LeBron James Scores!',
      text2: '3-pointer! Lakers lead 78-72 vs Celtics',
      position: 'top',
      visibilityTime: 4000,
      topOffset: 60,
    });

    // Schedule push notification (only on native devices)
    try {
      if (Device.isDevice) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '\ud83c\udfc0 Player Alert!',
            body: 'LeBron James scored a 3-pointer! (25 PTS)',
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
          },
          trigger: { seconds: 2 },
        });
      }
    } catch (error) {
      console.log('Push notification not available:', error);
    }
  };

  const handleGamePress = (gameId: string) => {
    router.push(`/game/${gameId}`);
  };

  const renderGameCard = (game: any, index: number) => {
    const isLive = game.status?.toLowerCase().includes('q') || 
                   game.status?.toLowerCase().includes('half') ||
                   game.status?.toLowerCase().includes('ot');

    return (
      <TouchableOpacity
        key={game.game_id}
        style={styles.gameCard}
        onPress={() => handleGamePress(game.game_id)}
        activeOpacity={0.9}
      >
        <LinearGradient
          colors={isLive ? ['#1a1a2e', '#16213e'] : ['#ffffff', '#f8fafc']}
          style={styles.cardGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Live Badge */}
          {isLive && (
            <View style={styles.liveBadgeContainer}>
              <LinearGradient
                colors={['#ef4444', '#dc2626']}
                style={styles.liveBadge}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Animated.View style={[styles.liveDot, { transform: [{ scale: pulseAnim }] }]} />
                <Text style={styles.liveText}>LIVE</Text>
              </LinearGradient>
            </View>
          )}

          {/* Status */}
          {!isLive && (
            <View style={styles.scheduledBadge}>
              <Ionicons name="time-outline" size={14} color="#64748b" />
              <Text style={styles.scheduledText}>{game.status || 'Scheduled'}</Text>
            </View>
          )}

          {/* Matchup */}
          <View style={styles.matchupContainer}>
            {/* Away Team */}
            <View style={styles.teamSection}>
              {game.away_logo ? (
                <Image source={{ uri: game.away_logo }} style={styles.teamLogo} resizeMode="contain" />
              ) : (
                <LinearGradient
                  colors={['#667eea', '#764ba2']}
                  style={styles.placeholderLogo}
                >
                  <Text style={styles.placeholderText}>{game.away_team?.substring(0, 3) || '?'}</Text>
                </LinearGradient>
              )}
              <Text style={[styles.teamCode, isLive && styles.teamCodeLight]}>{game.away_team || 'TBD'}</Text>
              <Text style={[styles.teamScore, isLive && styles.teamScoreLight]}>{game.away_score || 0}</Text>
            </View>

            {/* VS Indicator */}
            <View style={styles.vsContainer}>
              <View style={[styles.vsLine, isLive && styles.vsLineLight]} />
              <Text style={[styles.vsText, isLive && styles.vsTextLight]}>VS</Text>
              <View style={[styles.vsLine, isLive && styles.vsLineLight]} />
            </View>

            {/* Home Team */}
            <View style={styles.teamSection}>
              {game.home_logo ? (
                <Image source={{ uri: game.home_logo }} style={styles.teamLogo} resizeMode="contain" />
              ) : (
                <LinearGradient
                  colors={['#667eea', '#764ba2']}
                  style={styles.placeholderLogo}
                >
                  <Text style={styles.placeholderText}>{game.home_team?.substring(0, 3) || '?'}</Text>
                </LinearGradient>
              )}
              <Text style={[styles.teamCode, isLive && styles.teamCodeLight]}>{game.home_team || 'TBD'}</Text>
              <Text style={[styles.teamScore, isLive && styles.teamScoreLight]}>{game.home_score || 0}</Text>
            </View>
          </View>

          {/* Action Button */}
          <TouchableOpacity style={[styles.viewButton, isLive && styles.viewButtonLive]} activeOpacity={0.8}>
            <LinearGradient
              colors={isLive ? ['#667eea', '#764ba2'] : ['#f0f4ff', '#e8edff']}
              style={styles.viewButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={[styles.viewButtonText, isLive && styles.viewButtonTextLight]}>
                {isLive ? 'Watch Live' : 'View Details'}
              </Text>
              <Ionicons name="arrow-forward" size={16} color={isLive ? '#fff' : '#667eea'} />
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header Gradient */}
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>NBA Live</Text>
              <Text style={styles.headerSubtitle}>Real-time scores & player tracking</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity 
                style={styles.demoButton}
                onPress={showDemoNotification}
              >
                <Ionicons name="notifications" size={18} color="#667eea" />
                <Text style={styles.demoButtonText}>Demo</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.trackingButton}
                onPress={() => router.push('/tracked')}
              >
                <Ionicons name="star" size={20} color="#fff" />
                {trackedPlayers.length > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{trackedPlayers.length}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Connection Status */}
      <View style={[styles.connectionBar, connected ? styles.connectedBar : styles.disconnectedBar]}>
        <View style={styles.connectionContent}>
          <View style={[styles.connectionDot, connected ? styles.connectedDot : styles.disconnectedDot]} />
          <Text style={styles.connectionText}>
            {connected ? 'Live updates active' : 'Connecting...'}
          </Text>
        </View>
        <Text style={styles.refreshText}>Auto-refresh: 5s</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor="#667eea"
            colors={['#667eea']}
          />
        }
      >
        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today's Games</Text>
          <View style={styles.gameCount}>
            <Text style={styles.gameCountText}>{games.length}</Text>
          </View>
        </View>

        {/* Games List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#667eea" />
            <Text style={styles.loadingText}>Loading games...</Text>
          </View>
        ) : games.length === 0 ? (
          <View style={styles.emptyContainer}>
            <LinearGradient
              colors={['#f0f4ff', '#e8edff']}
              style={styles.emptyIcon}
            >
              <Ionicons name="basketball-outline" size={48} color="#667eea" />
            </LinearGradient>
            <Text style={styles.emptyTitle}>No Games Today</Text>
            <Text style={styles.emptySubtitle}>Check back later for NBA action!</Text>
            <TouchableOpacity onPress={onRefresh}>
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.retryButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.retryButtonText}>Refresh</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.gamesList}>
            {games.map((game, index) => renderGameCard(game, index))}
          </View>
        )}

        {/* Info Card */}
        <View style={styles.infoCard}>
          <LinearGradient
            colors={['#fef3c7', '#fde68a']}
            style={styles.infoGradient}
          >
            <Ionicons name="information-circle" size={24} color="#d97706" />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Real-Time Updates</Text>
              <Text style={styles.infoText}>
                Scores update every 5 seconds during live games. Track players to get instant notifications when they score!
              </Text>
            </View>
          </LinearGradient>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  headerGradient: {
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -1,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  demoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  demoButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#667eea',
  },
  trackingButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#667eea',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  connectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  connectedBar: {
    backgroundColor: '#dcfce7',
  },
  disconnectedBar: {
    backgroundColor: '#fef3c7',
  },
  connectionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  connectedDot: {
    backgroundColor: '#22c55e',
  },
  disconnectedDot: {
    backgroundColor: '#f59e0b',
  },
  connectionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  refreshText: {
    fontSize: 12,
    color: '#64748b',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
  },
  gameCount: {
    backgroundColor: '#667eea',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  gameCountText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#374151',
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 24,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  gamesList: {
    paddingHorizontal: 16,
  },
  gameCard: {
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  cardGradient: {
    padding: 20,
    borderRadius: 20,
  },
  liveBadgeContainer: {
    alignSelf: 'center',
    marginBottom: 16,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  liveText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  scheduledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    marginBottom: 16,
  },
  scheduledText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  matchupContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  teamSection: {
    flex: 1,
    alignItems: 'center',
  },
  teamLogo: {
    width: 60,
    height: 60,
    marginBottom: 10,
  },
  placeholderLogo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  placeholderText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
  teamCode: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
  },
  teamCodeLight: {
    color: 'rgba(255,255,255,0.8)',
  },
  teamScore: {
    fontSize: 36,
    fontWeight: '800',
    color: '#667eea',
  },
  teamScoreLight: {
    color: '#fff',
  },
  vsContainer: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  vsLine: {
    width: 1,
    height: 20,
    backgroundColor: '#e2e8f0',
    marginVertical: 4,
  },
  vsLineLight: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  vsText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9ca3af',
  },
  vsTextLight: {
    color: 'rgba(255,255,255,0.5)',
  },
  viewButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  viewButtonLive: {},
  viewButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  viewButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#667eea',
  },
  viewButtonTextLight: {
    color: '#fff',
  },
  infoCard: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 16,
    overflow: 'hidden',
  },
  infoGradient: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400e',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    color: '#a16207',
    lineHeight: 18,
  },
});
