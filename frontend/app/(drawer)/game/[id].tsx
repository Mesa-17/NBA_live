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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useTrackerStore } from '../../store/trackerStore';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://sleek-ios-hub.preview.emergentagent.com';

export default function GameDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'playbyplay' | 'players'>('playbyplay');
  const [gameInfo, setGameInfo] = useState<any>(null);

  const {
    gameData,
    trackedPlayers,
    playerStats,
    setGameData,
    addTrackedPlayer,
    removeTrackedPlayer,
  } = useTrackerStore();

  const currentGameData = gameData[id || ''] || gameInfo;

  // Calculate initial player stats from events
  const calculateInitialStats = (player: string, events: any[]) => {
    const lastNameParts = player.split(' ').slice(1);
    const lastName = lastNameParts.join(' ');
    
    let abbrName: string | null = null;
    let pts = 0, reb = 0, ast = 0;
    let subStatus: 'in' | 'out' = 'in';
    let subStatusFound = false;

    for (const event of events) {
      const desc = event.description || '';
      
      // Find abbreviation
      if (!abbrName && lastName && desc.includes(lastName)) {
        const pattern = new RegExp(`([A-Z]\\.\\s+${lastName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`);
        const match = desc.match(pattern);
        if (match) abbrName = match[1];
      }
      
      // Calculate stats
      if (abbrName && desc.includes(abbrName)) {
        const ptsMatch = desc.match(new RegExp(`${abbrName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*?\\((\\d+)\\s*PTS?\\)`, 'i'));
        if (ptsMatch) pts = Math.max(pts, parseInt(ptsMatch[1]));
        
        const rebMatch = desc.match(/Off:(\d+)\s+Def:(\d+)/i);
        if (rebMatch) reb = Math.max(reb, parseInt(rebMatch[1]) + parseInt(rebMatch[2]));
        
        const astPattern = new RegExp(`\\([^)]*\\)\\s*\\(${abbrName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+(\\d+)\\s*AST\\)`, 'i');
        const astMatch = desc.match(astPattern);
        if (astMatch) ast = Math.max(ast, parseInt(astMatch[1]));
      }
      
      // Check substitution status
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

  // Fetch game data
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
    
    // Poll for updates
    const pollInterval = setInterval(() => {
      fetchGameData();
    }, 10000);
    
    return () => clearInterval(pollInterval);
  }, [id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchGameData();
    setRefreshing(false);
  };

  const handleTrackPlayer = (player: string) => {
    if (trackedPlayers.includes(player)) {
      removeTrackedPlayer(player);
    } else {
      const events = currentGameData?.all_events || currentGameData?.events || [];
      const { stats, subStatus } = calculateInitialStats(player, events);
      addTrackedPlayer(player, stats, subStatus);
    }
  };

  const renderPlayByPlay = () => {
    const events = currentGameData?.events || [];
    
    if (events.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={48} color="#cbd5e1" />
          <Text style={styles.emptyText}>No play-by-play data available yet</Text>
          <Text style={styles.emptySubtext}>Game may not have started</Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.eventsList} nestedScrollEnabled>
        {events.map((event: any, index: number) => (
          <View key={index} style={styles.eventCard}>
            <View style={styles.eventTimeBox}>
              <Text style={styles.eventPeriod}>Q{event.period}</Text>
              <Text style={styles.eventClock}>{event.clock}</Text>
            </View>
            <View style={styles.eventContent}>
              <Text style={styles.eventText}>{event.description || 'N/A'}</Text>
              <Text style={styles.eventScore}>
                Score: {event.score_away} - {event.score_home}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
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
          <Ionicons name="people-outline" size={48} color="#cbd5e1" />
          <Text style={styles.emptyText}>No player data available yet</Text>
          <Text style={styles.emptySubtext}>Game may not have started</Text>
        </View>
      );
    }

    const homePlayers = players.filter((p: string) => teamMap[p] === homeTeam);
    const awayPlayers = players.filter((p: string) => teamMap[p] === awayTeam);

    const renderPlayerRow = (player: string) => {
      const isTracked = trackedPlayers.includes(player);
      const stats = playerStats[player];

      return (
        <View key={player} style={styles.playerRow}>
          <View style={styles.playerInfo}>
            <Text style={styles.playerName}>{player}</Text>
            {isTracked && stats && (
              <Text style={styles.playerStats}>
                PTS: {stats.pts} | REB: {stats.reb} | AST: {stats.ast}
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={[styles.trackButton, isTracked && styles.trackButtonActive]}
            onPress={() => handleTrackPlayer(player)}
          >
            <Ionicons
              name={isTracked ? 'notifications' : 'notifications-outline'}
              size={20}
              color={isTracked ? '#fff' : '#667eea'}
            />
          </TouchableOpacity>
        </View>
      );
    };

    return (
      <ScrollView style={styles.playersList} nestedScrollEnabled>
        {/* Away Team */}
        <View style={styles.teamSection}>
          <View style={styles.teamHeader}>
            {currentGameData?.away_logo && (
              <Image source={{ uri: currentGameData.away_logo }} style={styles.teamHeaderLogo} />
            )}
            <Text style={styles.teamHeaderText}>{awayTeam || 'Away Team'}</Text>
          </View>
          {awayPlayers.map(renderPlayerRow)}
        </View>

        {/* Home Team */}
        <View style={styles.teamSection}>
          <View style={styles.teamHeader}>
            {currentGameData?.home_logo && (
              <Image source={{ uri: currentGameData.home_logo }} style={styles.teamHeaderLogo} />
            )}
            <Text style={styles.teamHeaderText}>{homeTeam || 'Home Team'}</Text>
          </View>
          {homePlayers.map(renderPlayerRow)}
        </View>
      </ScrollView>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>Loading game data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#667eea" />
        }
      >
        {/* Game Header */}
        <View style={styles.gameHeader}>
          <View style={styles.headerTeams}>
            {/* Away Team */}
            <View style={styles.headerTeamBox}>
              {currentGameData?.away_logo ? (
                <Image source={{ uri: currentGameData.away_logo }} style={styles.headerTeamLogo} />
              ) : (
                <View style={styles.headerPlaceholder}>
                  <Text style={styles.headerPlaceholderText}>{currentGameData?.away_team || '?'}</Text>
                </View>
              )}
              <Text style={styles.headerTeamCode}>{currentGameData?.away_team || 'Away'}</Text>
            </View>

            {/* Score */}
            <View style={styles.headerScoreBox}>
              <Text style={styles.headerScore}>
                {currentGameData?.events?.[0]?.score_away || 0} - {currentGameData?.events?.[0]?.score_home || 0}
              </Text>
            </View>

            {/* Home Team */}
            <View style={styles.headerTeamBox}>
              {currentGameData?.home_logo ? (
                <Image source={{ uri: currentGameData.home_logo }} style={styles.headerTeamLogo} />
              ) : (
                <View style={styles.headerPlaceholder}>
                  <Text style={styles.headerPlaceholderText}>{currentGameData?.home_team || '?'}</Text>
                </View>
              )}
              <Text style={styles.headerTeamCode}>{currentGameData?.home_team || 'Home'}</Text>
            </View>
          </View>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'playbyplay' && styles.tabActive]}
            onPress={() => setActiveTab('playbyplay')}
          >
            <Ionicons
              name="list"
              size={18}
              color={activeTab === 'playbyplay' ? '#667eea' : '#64748b'}
            />
            <Text style={[styles.tabText, activeTab === 'playbyplay' && styles.tabTextActive]}>
              Play by Play
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'players' && styles.tabActive]}
            onPress={() => setActiveTab('players')}
          >
            <Ionicons
              name="people"
              size={18}
              color={activeTab === 'players' ? '#667eea' : '#64748b'}
            />
            <Text style={[styles.tabText, activeTab === 'players' && styles.tabTextActive]}>
              Players
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.contentContainer}>
          {activeTab === 'playbyplay' ? renderPlayByPlay() : renderPlayers()}
        </View>
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748b',
  },
  gameHeader: {
    backgroundColor: '#fff',
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
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
    width: 64,
    height: 64,
    marginBottom: 8,
  },
  headerPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  headerPlaceholderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  headerTeamCode: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  headerScoreBox: {
    paddingHorizontal: 16,
  },
  headerScore: {
    fontSize: 32,
    fontWeight: '800',
    color: '#667eea',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#667eea',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#667eea',
  },
  contentContainer: {
    flex: 1,
    padding: 16,
    minHeight: 400,
  },
  eventsList: {
    flex: 1,
  },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  eventTimeBox: {
    backgroundColor: '#667eea',
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
  },
  eventPeriod: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    opacity: 0.8,
  },
  eventClock: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  eventContent: {
    flex: 1,
    padding: 12,
  },
  eventText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  eventScore: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: '#9ca3af',
    fontWeight: '600',
  },
  emptySubtext: {
    marginTop: 4,
    fontSize: 14,
    color: '#cbd5e1',
  },
  playersList: {
    flex: 1,
  },
  teamSection: {
    marginBottom: 20,
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#667eea',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
    gap: 10,
  },
  teamHeaderLogo: {
    width: 28,
    height: 28,
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
    borderRadius: 10,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  playerStats: {
    fontSize: 12,
    color: '#667eea',
    marginTop: 2,
  },
  trackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f4ff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#667eea',
  },
  trackButtonActive: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
});
