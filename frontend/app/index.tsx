import React, { useEffect, useState, useRef, useMemo } from 'react';
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
import { io, Socket } from 'socket.io-client';
import { useTrackerStore } from './store/trackerStore';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://court-watch.preview.emergentagent.com';

// Helper to format date for display
const formatDateLabel = (dateStr: string) => {
  const date = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  if (dateStr === today.toISOString().split('T')[0]) {
    return 'Today';
  } else if (dateStr === tomorrow.toISOString().split('T')[0]) {
    return 'Tomorrow';
  } else {
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
};

export default function GamesScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>('today');
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  const {
    connected,
    games,
    trackedPlayers,
    setConnected,
    setGames,
    setPushToken,
    handleNewScore,
    handlePlayerAction,
  } = useTrackerStore();
  
  const socketRef = useRef<Socket | null>(null);

  // Get unique dates from games and create filter options
  const dateFilters = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const dates = new Set<string>();
    dates.add(today); // Always include today
    
    games.forEach(game => {
      if (game.game_date) {
        dates.add(game.game_date);
      }
    });
    
    const sortedDates = Array.from(dates).sort();
    return sortedDates.slice(0, 10); // Show max 10 date options
  }, [games]);

  // Filter games by selected date
  const filteredGames = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const filterDate = selectedDate === 'today' ? today : selectedDate;
    return games.filter(game => game.game_date === filterDate);
  }, [games, selectedDate]);

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
    
    // Connect to socket for real-time notifications
    const socket = io(`${API_URL}`, {
      transports: ['websocket', 'polling'],
      path: '/socket.io',
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket connected for notifications');
      setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      setConnected(false);
    });

    // Listen for real-time score events
    socket.on('new_score', (data) => {
      console.log('Received new_score event:', data);
      handleNewScore(data);
    });

    socket.on('player_action', (data) => {
      handlePlayerAction(data);
    });

    // Listen for game updates
    socket.on('games_update', (data) => {
      if (data.games) {
        setGames(data.games);
      }
    });
    
    // Real-time polling every 5 seconds for live updates
    const pollInterval = setInterval(() => {
      fetchGames();
    }, 5000);

    return () => {
      clearInterval(pollInterval);
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
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

  const renderGameCard = (game: any, index: number) => {
    const isLive = game.is_live || game.status?.toLowerCase().includes('q') || 
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
          {/* Live Badge or Status at top center */}
          <View style={styles.statusContainer}>
            {isLive ? (
              <LinearGradient
                colors={['#ef4444', '#dc2626']}
                style={styles.liveBadge}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Animated.View style={[styles.liveDot, { transform: [{ scale: pulseAnim }] }]} />
                <Text style={styles.liveText}>LIVE</Text>
              </LinearGradient>
            ) : (
              <View style={styles.scheduledBadge}>
                <Ionicons name="time-outline" size={12} color="#64748b" />
                <Text style={styles.scheduledText}>{game.status || 'Scheduled'}</Text>
              </View>
            )}
          </View>

          {/* Matchup Row: Away VS Home */}
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
              <View style={styles.teamInfo}>
                <Text style={[styles.teamCode, isLive && styles.teamCodeLight]}>{game.away_team || 'TBD'}</Text>
                <Text style={[styles.teamScore, isLive && styles.teamScoreLight]}>
                  {isLive || game.away_score > 0 ? game.away_score : '-'}
                </Text>
              </View>
            </View>

            {/* VS */}
            <View style={styles.vsContainer}>
              <Text style={[styles.vsText, isLive && styles.vsTextLight]}>VS</Text>
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
              <View style={styles.teamInfo}>
                <Text style={[styles.teamCode, isLive && styles.teamCodeLight]}>{game.home_team || 'TBD'}</Text>
                <Text style={[styles.teamScore, isLive && styles.teamScoreLight]}>
                  {isLive || game.home_score > 0 ? game.home_score : '-'}
                </Text>
              </View>
            </View>
          </View>
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
        {/* Date Filter */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.dateFilterContainer}
          contentContainerStyle={styles.dateFilterContent}
        >
          {dateFilters.map((date) => {
            const today = new Date().toISOString().split('T')[0];
            const isSelected = (selectedDate === 'today' && date === today) || selectedDate === date;
            const label = formatDateLabel(date);
            const gamesOnDate = games.filter(g => g.game_date === date).length;
            
            return (
              <TouchableOpacity
                key={date}
                onPress={() => setSelectedDate(date === today ? 'today' : date)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={isSelected ? ['#667eea', '#764ba2'] : ['#ffffff', '#f8fafc']}
                  style={[styles.dateFilterButton, isSelected && styles.dateFilterButtonActive]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={[styles.dateFilterText, isSelected && styles.dateFilterTextActive]}>
                    {label}
                  </Text>
                  <View style={[styles.dateFilterBadge, isSelected && styles.dateFilterBadgeActive]}>
                    <Text style={[styles.dateFilterBadgeText, isSelected && styles.dateFilterBadgeTextActive]}>
                      {gamesOnDate}
                    </Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {selectedDate === 'today' ? "Today's Games" : formatDateLabel(selectedDate)}
          </Text>
          <View style={styles.gameCount}>
            <Text style={styles.gameCountText}>{filteredGames.length}</Text>
          </View>
        </View>

        {/* Games List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#667eea" />
            <Text style={styles.loadingText}>Loading games...</Text>
          </View>
        ) : filteredGames.length === 0 ? (
          <View style={styles.emptyContainer}>
            <LinearGradient
              colors={['#f0f4ff', '#e8edff']}
              style={styles.emptyIcon}
            >
              <Ionicons name="basketball-outline" size={48} color="#667eea" />
            </LinearGradient>
            <Text style={styles.emptyTitle}>No Games</Text>
            <Text style={styles.emptySubtitle}>
              {selectedDate === 'today' 
                ? "No games scheduled for today. Check other dates!" 
                : "No games scheduled for this date."}
            </Text>
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
            {filteredGames.map((game, index) => renderGameCard(game, index))}
          </View>
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
  statusContainer: {
    alignItems: 'center',
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
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
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
  },
  teamSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamLogo: {
    width: 50,
    height: 50,
  },
  placeholderLogo: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
  },
  teamInfo: {
    marginLeft: 10,
  },
  teamCode: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 2,
  },
  teamCodeLight: {
    color: 'rgba(255,255,255,0.9)',
  },
  teamScore: {
    fontSize: 28,
    fontWeight: '800',
    color: '#667eea',
  },
  teamScoreLight: {
    color: '#fff',
  },
  vsContainer: {
    paddingHorizontal: 16,
  },
  vsText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9ca3af',
  },
  vsTextLight: {
    color: 'rgba(255,255,255,0.5)',
  },
  dateFilterContainer: {
    marginTop: 16,
  },
  dateFilterContent: {
    paddingHorizontal: 16,
    gap: 10,
    flexDirection: 'row',
  },
  dateFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    marginRight: 10,
    gap: 8,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  dateFilterButtonActive: {
    shadowOpacity: 0.25,
  },
  dateFilterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  dateFilterTextActive: {
    color: '#fff',
  },
  dateFilterBadge: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  dateFilterBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dateFilterBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
  },
  dateFilterBadgeTextActive: {
    color: '#fff',
  },
});
