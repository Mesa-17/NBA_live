import React, { useEffect, useCallback, useRef, useState } from 'react';
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
import { io, Socket } from 'socket.io-client';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useTrackerStore } from './store/trackerStore';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://sleek-ios-hub.preview.emergentagent.com';
const SOCKET_URL = API_URL;

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

export default function GamesScreen() {
  const socketRef = useRef<Socket | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const {
    connected,
    games,
    setConnected,
    setGames,
    setGameData,
    handleNewScore,
    handlePlayerAction,
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

  // Initialize socket connection
  const initSocket = useCallback(() => {
    if (socketRef.current?.connected) return;

    console.log('🔌 Connecting to:', SOCKET_URL);
    
    const socket = io(SOCKET_URL, {
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      forceNew: true,
    });

    socket.on('connect', () => {
      console.log('✅ Connected to NBA server!');
      setConnected(true);
      socket.emit('request_games', {});
    });

    socket.on('disconnect', () => {
      console.log('❌ Disconnected from server');
      setConnected(false);
    });

    socket.on('games_update', (data) => {
      console.log('📥 Received games:', data.games?.length);
      setGames(data.games || []);
      setLoading(false);
    });

    socket.on('game_data', (data) => {
      console.log('📥 Received game data for:', data.game_id);
      setGameData(data.game_id, data);
    });

    socket.on('new_score', (data) => {
      console.log('🏀 New score:', data.description);
      handleNewScore(data);
    });

    socket.on('player_action', (data) => {
      handlePlayerAction(data);
    });

    socket.on('connect_error', (error) => {
      console.log('❌ Connection error:', error.message);
      setLoading(false);
    });

    socketRef.current = socket;
  }, []);

  // Fetch games via REST API as fallback
  const fetchGames = async () => {
    try {
      const response = await fetch(`${API_URL}/api/games`);
      const data = await response.json();
      setGames(data.games || []);
      setLoading(false);
    } catch (error) {
      console.log('Error fetching games:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    registerForPushNotifications();
    initSocket();
    fetchGames();

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchGames();
    socketRef.current?.emit('request_games', {});
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

          {/* Teams */}
          <View style={styles.teamsContainer}>
            {/* Away Team */}
            <View style={styles.teamBox}>
              {game.away_logo ? (
                <Image source={{ uri: game.away_logo }} style={styles.teamLogo} resizeMode="contain" />
              ) : (
                <View style={styles.placeholderLogo}>
                  <Text style={styles.placeholderText}>{game.away_team}</Text>
                </View>
              )}
              <Text style={styles.teamCode}>{game.away_team}</Text>
              <Text style={styles.score}>{game.away_score || 0}</Text>
            </View>

            {/* VS Divider */}
            <View style={styles.vsDivider}>
              <Text style={styles.vsText}>VS</Text>
            </View>

            {/* Home Team */}
            <View style={styles.teamBox}>
              {game.home_logo ? (
                <Image source={{ uri: game.home_logo }} style={styles.teamLogo} resizeMode="contain" />
              ) : (
                <View style={styles.placeholderLogo}>
                  <Text style={styles.placeholderText}>{game.home_team}</Text>
                </View>
              )}
              <Text style={styles.teamCode}>{game.home_team}</Text>
              <Text style={styles.score}>{game.home_score || 0}</Text>
            </View>
          </View>

          {/* View Match Button */}
          <View style={styles.viewButton}>
            <Text style={styles.viewButtonText}>View Match</Text>
            <Ionicons name="chevron-forward" size={16} color="#667eea" />
          </View>
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
          <Text style={styles.headerTitle}>Today's Games</Text>
          <Text style={styles.headerSubtitle}>
            {games.length > 0 ? `${games.length} games scheduled` : 'Loading games...'}
          </Text>
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
    fontSize: 12,
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
