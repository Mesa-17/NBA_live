import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useTrackerStore } from './store/trackerStore';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://sleek-ios-hub.preview.emergentagent.com';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

export default function GamesScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const {
    connected,
    games,
    trackedPlayers,
    setConnected,
    setGames,
    setPushToken,
  } = useTrackerStore();

  // Register for push notifications
  const registerForPushNotifications = async () => {
    if (!Device.isDevice) {
      console.log('Must use physical device for Push Notifications');
      return;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }

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

  // Fetch games via REST API
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
    
    // Set up polling for updates
    const pollInterval = setInterval(() => {
      fetchGames();
    }, 10000);

    return () => {
      clearInterval(pollInterval);
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchGames();
    setRefreshing(false);
  };

  const handleGamePress = (gameId: string) => {
    router.push(`/game/${gameId}`);
  };

  const renderGameCard = (game: any) => {
    const isLive = game.status?.toLowerCase().includes('q') || 
                   game.status?.toLowerCase().includes('half') ||
                   game.status?.toLowerCase().includes('ot');

    return (
      <TouchableOpacity
        key={game.game_id}
        style={styles.gameCard}
        onPress={() => handleGamePress(game.game_id)}
        activeOpacity={0.8}
      >
        <View style={styles.cardContent}>
          {/* Status Badge */}
          <View style={[styles.statusBadge, isLive && styles.statusLive]}>
            {isLive && <View style={styles.liveDot} />}
            <Text style={[styles.statusText, isLive && styles.statusTextLive]}>
              {game.status || 'Scheduled'}
            </Text>
          </View>

          {/* Teams Row */}
          <View style={styles.teamsRow}>
            {/* Away Team */}
            <View style={styles.teamColumn}>
              {game.away_logo ? (
                <Image source={{ uri: game.away_logo }} style={styles.teamLogo} resizeMode="contain" />
              ) : (
                <View style={styles.placeholderLogo}>
                  <Text style={styles.placeholderText}>{game.away_team?.substring(0, 3) || '?'}</Text>
                </View>
              )}
              <Text style={styles.teamCode}>{game.away_team || 'TBD'}</Text>
            </View>

            {/* Score Section */}
            <View style={styles.scoreSection}>
              <Text style={styles.scoreText}>{game.away_score || 0}</Text>
              <Text style={styles.vsText}>-</Text>
              <Text style={styles.scoreText}>{game.home_score || 0}</Text>
            </View>

            {/* Home Team */}
            <View style={styles.teamColumn}>
              {game.home_logo ? (
                <Image source={{ uri: game.home_logo }} style={styles.teamLogo} resizeMode="contain" />
              ) : (
                <View style={styles.placeholderLogo}>
                  <Text style={styles.placeholderText}>{game.home_team?.substring(0, 3) || '?'}</Text>
                </View>
              )}
              <Text style={styles.teamCode}>{game.home_team || 'TBD'}</Text>
            </View>
          </View>

          {/* View Match Button */}
          <TouchableOpacity style={styles.viewButton} activeOpacity={0.7}>
            <Text style={styles.viewButtonText}>View Match</Text>
            <Ionicons name="chevron-forward" size={16} color="#667eea" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Connection Status */}
      <View style={[styles.connectionBar, connected ? styles.connectedBar : styles.disconnectedBar]}>
        <View style={[styles.connectionDot, connected ? styles.connectedDot : styles.disconnectedDot]} />
        <Text style={styles.connectionText}>
          {connected ? 'Connected to NBA Live Server' : 'Connecting...'}
        </Text>
        {trackedPlayers.length > 0 && (
          <TouchableOpacity 
            style={styles.trackedBadge}
            onPress={() => router.push('/tracked')}
          >
            <Ionicons name="notifications" size={14} color="#fff" />
            <Text style={styles.trackedBadgeText}>{trackedPlayers.length}</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#667eea" />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.headerTitle}>Today's Games</Text>
              <Text style={styles.headerSubtitle}>
                {games.length > 0 ? `${games.length} games scheduled` : 'Loading games...'}
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.trackingButton}
              onPress={() => router.push('/tracked')}
            >
              <Ionicons name="notifications" size={22} color="#667eea" />
              {trackedPlayers.length > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{trackedPlayers.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Games Grid */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#667eea" />
            <Text style={styles.loadingText}>Loading games...</Text>
          </View>
        ) : games.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="basketball-outline" size={64} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>No Games Today</Text>
            <Text style={styles.emptySubtitle}>Check back later for NBA action!</Text>
            <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
              <Text style={styles.retryButtonText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.gamesGrid}>
            {games.map(renderGameCard)}
          </View>
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
  connectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  connectedBar: {
    backgroundColor: '#dcfce7',
  },
  disconnectedBar: {
    backgroundColor: '#fef3c7',
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
    fontWeight: '500',
    color: '#374151',
    flex: 1,
  },
  trackedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#667eea',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  trackedBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1f2937',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#64748b',
  },
  trackingButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f0f4ff',
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
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748b',
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
  },
  retryButton: {
    marginTop: 24,
    backgroundColor: '#667eea',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  gamesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 12,
  },
  gameCard: {
    width: CARD_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  cardContent: {
    padding: 14,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
    marginBottom: 12,
  },
  statusLive: {
    backgroundColor: '#dcfce7',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  statusTextLive: {
    color: '#16a34a',
  },
  teamsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  teamBox: {
    flex: 1,
    alignItems: 'center',
  },
  teamLogo: {
    width: 44,
    height: 44,
    marginBottom: 6,
  },
  placeholderLogo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  placeholderText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
  },
  teamCode: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 2,
  },
  score: {
    fontSize: 22,
    fontWeight: '800',
    color: '#667eea',
  },
  vsDivider: {
    paddingHorizontal: 8,
  },
  vsText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9ca3af',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f4ff',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 4,
  },
  viewButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#667eea',
  },
});
