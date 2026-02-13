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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useTrackerStore } from '../store/trackerStore';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://court-watch.preview.emergentagent.com';

export default function GameDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'playbyplay' | 'players'>('playbyplay');
  const [gameInfo, setGameInfo] = useState<any>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const {
    gameData,
    trackedPlayers,
    playerStats,
    setGameData,
    addTrackedPlayer,
    removeTrackedPlayer,
  } = useTrackerStore();

  const currentGameData = gameData[id || ''] || gameInfo;

  const calculateInitialStats = (player: string, events: any[]) => {
    const lastNameParts = player.split(' ').slice(1);
    const lastName = lastNameParts.join(' ');
    
    let abbrName: string | null = null;
    let pts = 0, reb = 0, ast = 0;
    let subStatus: 'in' | 'out' = 'in';
    let subStatusFound = false;

    for (const event of events) {
      const desc = event.description || '';
      
      if (!abbrName && lastName && desc.includes(lastName)) {
        const pattern = new RegExp(`([A-Z]\\.\\s+${lastName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`);
        const match = desc.match(pattern);
        if (match) abbrName = match[1];
      }
      
      if (abbrName && desc.includes(abbrName)) {
        const ptsMatch = desc.match(new RegExp(`${abbrName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*?\\((\\d+)\\s*PTS?\\)`, 'i'));
        if (ptsMatch) pts = Math.max(pts, parseInt(ptsMatch[1]));
        
        const rebMatch = desc.match(/Off:(\d+)\s+Def:(\d+)/i);
        if (rebMatch) reb = Math.max(reb, parseInt(rebMatch[1]) + parseInt(rebMatch[2]));
        
        const astPattern = new RegExp(`\\([^)]*\\)\\s*\\(${abbrName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+(\\d+)\\s*AST\\)`, 'i');
        const astMatch = desc.match(astPattern);
        if (astMatch) ast = Math.max(ast, parseInt(astMatch[1]));
      }
      
      if (!subStatusFound && (desc.includes(player) || (abbrName && desc.includes(abbrName)))) {
        if (desc.toUpperCase().includes('SUB IN') || desc.toUpperCase().includes('ENTERS')) {
          subStatus = 'in';
          subStatusFound = true;
        } else if (desc.toUpperCase().includes('SUB OUT') || desc.toUpperCase().includes('GOES TO BENCH')) {
          subStatus = 'out';
          subStatusFound = true;
        }
      }
    }
    
    return { stats: { pts, reb, ast }, subStatus };
  };

  const fetchGameData = async () => {
    if (!id) return;
    
    try {
      const response = await fetch(`${API_URL}/api/game/${id}`);
      const data = await response.json();
      setGameInfo(data);
      setGameData(id, data);
      setLoading(false);
    } catch (error) {
      console.log('Error fetching game:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGameData();
    // Real-time updates every 5 seconds
    const pollInterval = setInterval(() => fetchGameData(), 5000);
    return () => clearInterval(pollInterval);
  }, [id]);

  const switchTab = (tab: 'playbyplay' | 'players') => {
    Animated.spring(slideAnim, {
      toValue: tab === 'playbyplay' ? 0 : 1,
      useNativeDriver: true,
    }).start();
    setActiveTab(tab);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchGameData();
    setRefreshing(false);
  };

  const handleTrackPlayer = (player: string) => {
    if (trackedPlayers.includes(player)) {
      removeTrackedPlayer(player);
      Toast.show({
        type: 'info',
        text1: 'Player Removed',
        text2: `${player} removed from tracking`,
        position: 'top',
        visibilityTime: 2000,
      });
    } else {
      const events = currentGameData?.all_events || currentGameData?.events || [];
      const { stats, subStatus } = calculateInitialStats(player, events);
      addTrackedPlayer(player, stats, subStatus);
      Toast.show({
        type: 'success',
        text1: '\ud83d\udd14 Player Tracked!',
        text2: `You\'ll get notifications when ${player} scores`,
        position: 'top',
        visibilityTime: 2000,
      });
    }
  };

  const renderPlayByPlay = () => {
    const events = currentGameData?.events || [];
    
    if (events.length === 0) {
      return (
        <View style={styles.emptyState}>
          <LinearGradient colors={['#f0f4ff', '#e8edff']} style={styles.emptyIcon}>
            <Ionicons name="document-text-outline" size={40} color="#667eea" />
          </LinearGradient>
          <Text style={styles.emptyText}>No play-by-play data yet</Text>
          <Text style={styles.emptySubtext}>Game hasn't started</Text>
        </View>
      );
    }

    return (
      <View style={styles.eventsList}>
        {events.map((event: any, index: number) => (
          <View key={index} style={styles.eventCard}>
            <LinearGradient colors={['#667eea', '#764ba2']} style={styles.eventTimeBox}>
              <Text style={styles.eventPeriod}>Q{event.period}</Text>
              <Text style={styles.eventClock}>{event.clock}</Text>
            </LinearGradient>
            <View style={styles.eventContent}>
              <Text style={styles.eventText}>{event.description || 'N/A'}</Text>
              <View style={styles.eventScoreRow}>
                <Ionicons name="basketball" size={12} color="#667eea" />
                <Text style={styles.eventScore}>{event.score_away} - {event.score_home}</Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderPlayers = () => {
    const players = currentGameData?.players || [];
    const teamMap = currentGameData?.team_map || {};
    const homeTeam = currentGameData?.home_team || '';
    const awayTeam = currentGameData?.away_team || '';

    if (players.length === 0) {
      return (
        <View style={styles.emptyState}>
          <LinearGradient colors={['#f0f4ff', '#e8edff']} style={styles.emptyIcon}>
            <Ionicons name="people-outline" size={40} color="#667eea" />
          </LinearGradient>
          <Text style={styles.emptyText}>No player data yet</Text>
          <Text style={styles.emptySubtext}>Game hasn't started</Text>
        </View>
      );
    }

    const homePlayers = players.filter((p: string) => teamMap[p] === homeTeam);
    const awayPlayers = players.filter((p: string) => teamMap[p] === awayTeam);

    const renderPlayerRow = (player: string) => {
      const isTracked = trackedPlayers.includes(player);
      const stats = playerStats[player];

      return (
        <TouchableOpacity 
          key={player} 
          style={styles.playerRow}
          onPress={() => handleTrackPlayer(player)}
          activeOpacity={0.7}
        >
          <View style={styles.playerInfo}>
            <Text style={styles.playerName}>{player}</Text>
            {isTracked && stats && (
              <View style={styles.playerStatsRow}>
                <View style={styles.miniStat}>
                  <Text style={styles.miniStatValue}>{stats.pts}</Text>
                  <Text style={styles.miniStatLabel}>PTS</Text>
                </View>
                <View style={styles.miniStat}>
                  <Text style={styles.miniStatValue}>{stats.reb}</Text>
                  <Text style={styles.miniStatLabel}>REB</Text>
                </View>
                <View style={styles.miniStat}>
                  <Text style={styles.miniStatValue}>{stats.ast}</Text>
                  <Text style={styles.miniStatLabel}>AST</Text>
                </View>
              </View>
            )}
          </View>
          <View style={[styles.trackButton, isTracked && styles.trackButtonActive]}>
            {isTracked ? (
              <LinearGradient colors={['#667eea', '#764ba2']} style={styles.trackButtonGradient}>
                <Ionicons name="notifications" size={18} color="#fff" />
              </LinearGradient>
            ) : (
              <Ionicons name="notifications-outline" size={18} color="#667eea" />
            )}
          </View>
        </TouchableOpacity>
      );
    };

    return (
      <View style={styles.playersList}>
        <View style={styles.teamSection}>
          <LinearGradient colors={['#667eea', '#764ba2']} style={styles.teamHeader}>
            {currentGameData?.away_logo && (
              <Image source={{ uri: currentGameData.away_logo }} style={styles.teamHeaderLogo} />
            )}
            <Text style={styles.teamHeaderText}>{awayTeam || 'Away Team'}</Text>
          </LinearGradient>
          {awayPlayers.map(renderPlayerRow)}
        </View>

        <View style={styles.teamSection}>
          <LinearGradient colors={['#667eea', '#764ba2']} style={styles.teamHeader}>
            {currentGameData?.home_logo && (
              <Image source={{ uri: currentGameData.home_logo }} style={styles.teamHeaderLogo} />
            )}
            <Text style={styles.teamHeaderText}>{homeTeam || 'Home Team'}</Text>
          </LinearGradient>
          {homePlayers.map(renderPlayerRow)}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading game...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#667eea" />
        }
      >
        {/* Game Header */}
        <LinearGradient colors={['#667eea', '#764ba2']} style={styles.gameHeader}>
          <View style={styles.headerTeams}>
            <View style={styles.headerTeamBox}>
              {currentGameData?.away_logo ? (
                <Image source={{ uri: currentGameData.away_logo }} style={styles.headerTeamLogo} />
              ) : (
                <View style={styles.headerPlaceholder}>
                  <Text style={styles.headerPlaceholderText}>{currentGameData?.away_team || '?'}</Text>
                </View>
              )}
              <Text style={styles.headerTeamCode}>{currentGameData?.away_team || 'Away'}</Text>
              <Text style={styles.headerScore}>{currentGameData?.events?.[0]?.score_away || 0}</Text>
            </View>

            <View style={styles.headerVs}>
              <Text style={styles.headerVsText}>VS</Text>
            </View>

            <View style={styles.headerTeamBox}>
              {currentGameData?.home_logo ? (
                <Image source={{ uri: currentGameData.home_logo }} style={styles.headerTeamLogo} />
              ) : (
                <View style={styles.headerPlaceholder}>
                  <Text style={styles.headerPlaceholderText}>{currentGameData?.home_team || '?'}</Text>
                </View>
              )}
              <Text style={styles.headerTeamCode}>{currentGameData?.home_team || 'Home'}</Text>
              <Text style={styles.headerScore}>{currentGameData?.events?.[0]?.score_home || 0}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'playbyplay' && styles.tabActive]}
            onPress={() => switchTab('playbyplay')}
          >
            <Ionicons name="list" size={18} color={activeTab === 'playbyplay' ? '#667eea' : '#64748b'} />
            <Text style={[styles.tabText, activeTab === 'playbyplay' && styles.tabTextActive]}>Play by Play</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'players' && styles.tabActive]}
            onPress={() => switchTab('players')}
          >
            <Ionicons name="people" size={18} color={activeTab === 'players' ? '#667eea' : '#64748b'} />
            <Text style={[styles.tabText, activeTab === 'players' && styles.tabTextActive]}>Players</Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.contentContainer}>
          {activeTab === 'playbyplay' ? renderPlayByPlay() : renderPlayers()}
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
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
  },
  gameHeader: {
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  headerTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTeamBox: {
    flex: 1,
    alignItems: 'center',
  },
  headerTeamLogo: {
    width: 70,
    height: 70,
    marginBottom: 12,
  },
  headerPlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  headerPlaceholderText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  headerTeamCode: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  headerScore: {
    fontSize: 42,
    fontWeight: '800',
    color: '#fff',
  },
  headerVs: {
    paddingHorizontal: 16,
  },
  headerVsText: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: -20,
    borderRadius: 16,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  tabActive: {
    backgroundColor: '#f0f4ff',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#667eea',
  },
  contentContainer: {
    padding: 16,
    paddingTop: 24,
  },
  eventsList: {},
  eventCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  eventTimeBox: {
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 65,
  },
  eventPeriod: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 2,
  },
  eventClock: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  eventContent: {
    flex: 1,
    padding: 14,
  },
  eventText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  eventScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  eventScore: {
    fontSize: 13,
    fontWeight: '600',
    color: '#667eea',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  emptySubtext: {
    marginTop: 6,
    fontSize: 14,
    color: '#9ca3af',
  },
  playersList: {},
  teamSection: {
    marginBottom: 24,
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
    gap: 12,
  },
  teamHeaderLogo: {
    width: 32,
    height: 32,
  },
  teamHeaderText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  playerStatsRow: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 16,
  },
  miniStat: {
    alignItems: 'center',
  },
  miniStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#667eea',
  },
  miniStatLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9ca3af',
  },
  trackButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f0f4ff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#667eea',
  },
  trackButtonActive: {
    borderWidth: 0,
    overflow: 'hidden',
  },
  trackButtonGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
