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
import { useTrackerStore } from './store/trackerStore';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://court-watch.preview.emergentagent.com';

// Helper to format date for display - "Today" for current day, date for others
const formatDateLabel = (dateStr: string) => {
  const date = new Date(dateStr + 'T12:00:00'); // Add time to avoid timezone issues
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  if (dateStr === todayStr) {
    return 'Today';
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
  } = useTrackerStore();

  // Cached date filters - once we see dates, we keep them
  const cachedDatesRef = useRef<Set<string>>(new Set());
  const cachedCountsRef = useRef<Map<string, number>>(new Map());
  
  // Get unique dates from games and create filter options
  const dateFilters = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    cachedDatesRef.current.add(today); // Always include today
    
    games.forEach(game => {
      if (game.game_date) {
        cachedDatesRef.current.add(game.game_date);
        // Update counts - only increase, never decrease (to prevent flicker)
        const currentCount = cachedCountsRef.current.get(game.game_date) || 0;
        const newCount = games.filter(g => g.game_date === game.game_date).length;
        if (newCount > currentCount) {
          cachedCountsRef.current.set(game.game_date, newCount);
        }
      }
    });
    
    const sortedDates = Array.from(cachedDatesRef.current).sort();
    return sortedDates.slice(0, 10); // Show max 10 date options
  }, [games]);
  
  // Helper to get game count for a date
  const getGameCount = (date: string) => {
    return cachedCountsRef.current.get(date) || games.filter(g => g.game_date === date).length;
  };

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

  // Reference to track if this is the initial load
  const isInitialLoad = useRef(true);
  const lastGamesHash = useRef('');

  const fetchGames = async () => {
    try {
      const response = await fetch(`${API_URL}/api/games`);
      const data = await response.json();
      const newGames = data.games || [];
      
      // Create a simple hash to check if data changed (based on scores)
      const newHash = newGames.map((g: any) => `${g.game_id}:${g.home_score}:${g.away_score}:${g.status}`).join('|');
      
      // Only update state if the data actually changed or it's the initial load
      if (isInitialLoad.current || newHash !== lastGamesHash.current) {
        // Preserve game order by merging updates instead of replacing
        if (!isInitialLoad.current && games.length > 0) {
          // Update existing games in place to avoid re-ordering
          const updatedGames = games.map(existingGame => {
            const newGame = newGames.find((g: any) => g.game_id === existingGame.game_id);
            return newGame || existingGame;
          });
          // Add any new games that weren't in the old list
          const existingIds = new Set(games.map((g: any) => g.game_id));
          const brandNewGames = newGames.filter((g: any) => !existingIds.has(g.game_id));
          setGames([...updatedGames, ...brandNewGames]);
        } else {
          setGames(newGames);
        }
        lastGamesHash.current = newHash;
        isInitialLoad.current = false;
      }
      
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

            {/* Home Team - Logo on right */}
            <View style={styles.teamSectionRight}>
              <View style={styles.teamInfo}>
                <Text style={[styles.teamCode, isLive && styles.teamCodeLight]}>{game.home_team || 'TBD'}</Text>
                <Text style={[styles.teamScore, isLive && styles.teamScoreLight]}>
                  {isLive || game.home_score > 0 ? game.home_score : '-'}
                </Text>
              </View>
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
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Hero Header */}
      <LinearGradient
        colors={['#1a1a2e', '#16213e', '#0f3460']}
        style={styles.heroGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.heroContent}>
            {/* Top Bar */}
            <View style={styles.topBar}>
              <View style={styles.logoContainer}>
                <Text style={styles.logoEmoji}>🏀</Text>
                <View>
                  <Text style={styles.logoText}>CourtWatch</Text>
                  <Text style={styles.logoTagline}>Live NBA Tracker</Text>
                </View>
              </View>
              <TouchableOpacity 
                style={styles.trackingButton}
                onPress={() => router.push('/tracked')}
              >
                <Ionicons name="star" size={22} color="#fbbf24" />
                {trackedPlayers.length > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{trackedPlayers.length}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{filteredGames.filter(g => g.is_live || g.status?.includes('Q') || g.status?.includes('Half')).length}</Text>
                <Text style={styles.statLabel}>Live Now</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{filteredGames.length}</Text>
                <Text style={styles.statLabel}>Games Today</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{trackedPlayers.length}</Text>
                <Text style={styles.statLabel}>Tracking</Text>
              </View>
            </View>

            {/* Connection Status */}
            <View style={styles.connectionPill}>
              <View style={[styles.connectionDot, connected ? styles.connectedDot : styles.disconnectedDot]} />
              <Text style={styles.connectionPillText}>
                {connected ? 'Real-time updates active' : 'Connecting...'}
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

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
            const gamesOnDate = getGameCount(date);
            
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
  heroGradient: {
    paddingBottom: 20,
  },
  heroContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoEmoji: {
    fontSize: 32,
  },
  logoText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  logoTagline: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: -2,
  },
  trackingButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
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
    borderColor: '#1a1a2e',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 8,
  },
  connectionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'center',
    gap: 8,
  },
  connectionPillText: {
    color: '#22c55e',
    fontSize: 13,
    fontWeight: '600',
  },
  connectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  disconnectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f59e0b',
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
  teamSectionRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
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
    marginHorizontal: 10,
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
