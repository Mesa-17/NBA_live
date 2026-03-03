import { create } from 'zustand';
import Toast from 'react-native-toast-message';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

interface PlayerStats {
  pts: number;
  reb: number;
  ast: number;
}

interface TrackerStore {
  connected: boolean;
  games: any[];
  selectedGameId: string | null;
  gameData: { [key: string]: any };
  trackedPlayers: string[];
  playerStats: { [key: string]: PlayerStats };
  playerSubStatus: { [key: string]: 'in' | 'out' };
  notifiedActions: Set<string>;
  pushToken: string | null;
  
  setConnected: (connected: boolean) => void;
  setGames: (games: any[]) => void;
  setSelectedGameId: (id: string | null) => void;
  setGameData: (gameId: string, data: any) => void;
  addTrackedPlayer: (player: string, initialStats?: PlayerStats, subStatus?: 'in' | 'out') => void;
  removeTrackedPlayer: (player: string) => void;
  updatePlayerStats: (player: string, stats: Partial<PlayerStats>) => void;
  updatePlayerSubStatus: (player: string, status: 'in' | 'out') => void;
  handleNewScore: (data: any) => void;
  handlePlayerAction: (data: any) => void;
  setPushToken: (token: string) => void;
  isPlayerTracked: (player: string) => boolean;
}

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function sendPushNotification(title: string, body: string) {
  try {
    // Request permissions first
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      const { status: newStatus } = await Notifications.requestPermissionsAsync();
      if (newStatus !== 'granted') {
        console.log('Notification permission not granted');
        return;
      }
    }
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null, // Send immediately
    });
  } catch (error) {
    console.log('Push notification error:', error);
  }
}

export const useTrackerStore = create<TrackerStore>((set, get) => ({
  connected: false,
  games: [],
  selectedGameId: null,
  gameData: {},
  trackedPlayers: [],
  playerStats: {},
  playerSubStatus: {},
  notifiedActions: new Set(),
  pushToken: null,

  setConnected: (connected) => set({ connected }),
  
  setGames: (games) => set({ games }),
  
  setSelectedGameId: (id) => set({ selectedGameId: id }),
  
  setGameData: (gameId, data) => set((state) => ({
    gameData: { ...state.gameData, [gameId]: data }
  })),
  
  addTrackedPlayer: (player, initialStats = { pts: 0, reb: 0, ast: 0 }, subStatus = 'in') => {
    set((state) => {
      if (state.trackedPlayers.includes(player)) return state;
      return {
        trackedPlayers: [...state.trackedPlayers, player],
        playerStats: { ...state.playerStats, [player]: initialStats },
        playerSubStatus: { ...state.playerSubStatus, [player]: subStatus },
      };
    });
  },
  
  removeTrackedPlayer: (player) => {
    set((state) => {
      const newStats = { ...state.playerStats };
      const newSubStatus = { ...state.playerSubStatus };
      delete newStats[player];
      delete newSubStatus[player];
      return {
        trackedPlayers: state.trackedPlayers.filter((p) => p !== player),
        playerStats: newStats,
        playerSubStatus: newSubStatus,
      };
    });
  },
  
  updatePlayerStats: (player, stats) => {
    set((state) => {
      const currentStats = state.playerStats[player] || { pts: 0, reb: 0, ast: 0 };
      return {
        playerStats: {
          ...state.playerStats,
          [player]: { ...currentStats, ...stats },
        },
      };
    });
  },
  
  updatePlayerSubStatus: (player, status) => {
    set((state) => ({
      playerSubStatus: { ...state.playerSubStatus, [player]: status },
    }));
  },
  
  handleNewScore: (data) => {
    const state = get();
    const playerName = data.player_name;
    const desc = data.description || '';
    const totalPoints = data.total_points || 0;
    const period = data.period || 1;
    const clock = data.clock || '00:00';
    const scoreHome = data.score_home || 0;
    const scoreAway = data.score_away || 0;
    const homeTeam = data.home_team || '';
    const awayTeam = data.away_team || '';
    
    if (!playerName || !state.trackedPlayers.includes(playerName)) return;
    
    const actionId = `${data.game_id}_${data.action_id}`;
    if (state.notifiedActions.has(actionId)) return;
    
    // Update points from backend data
    if (totalPoints > 0) {
      set((s) => ({
        playerStats: {
          ...s.playerStats,
          [playerName]: { ...s.playerStats[playerName], pts: totalPoints },
        },
      }));
    }
    
    // Determine score type
    let scoreType = '2-pointer';
    const descLower = desc.toLowerCase();
    if (descLower.includes('3pt') || descLower.includes('three point') || descLower.includes('3-pointer')) {
      scoreType = '3-pointer';
    } else if (descLower.includes('free throw') || descLower.includes(' ft ')) {
      scoreType = 'Free Throw';
    }
    
    // Format: "LeBron James Scores 3-pointer (25 pts)"
    const title = `🏀 ${playerName} Scores ${scoreType} (${totalPoints} pts)`;
    
    // Format: "Q1 - 04:00 | Lakers lead 78-72 vs Celtics"
    const periodStr = period > 4 ? `OT${period - 4}` : `Q${period}`;
    const leadingTeam = scoreHome > scoreAway ? homeTeam : awayTeam;
    const leadScore = Math.max(scoreHome, scoreAway);
    const trailScore = Math.min(scoreHome, scoreAway);
    const gameScore = scoreHome === scoreAway 
      ? `Tied ${scoreHome}-${scoreAway}` 
      : `${leadingTeam} lead ${leadScore}-${trailScore}`;
    const body = `${periodStr} - ${clock} | ${gameScore} vs ${scoreHome > scoreAway ? awayTeam : homeTeam}`;
    
    // Show in-app toast
    Toast.show({
      type: 'success',
      text1: title,
      text2: body,
      position: 'top',
      visibilityTime: 4000,
      topOffset: 60,
    });
    
    // Send push notification (works even when app is in background)
    sendPushNotification(title, body);
    
    // Mark as notified
    set((s) => ({
      notifiedActions: new Set([...s.notifiedActions, actionId]),
    }));
  },
  
  handlePlayerAction: (data) => {
    const state = get();
    const playerName = data.player_name;
    const desc = data.description || '';
    const abbrName = data.abbr_name || '';
    
    if (!playerName) return;
    
    // Update stats for tracked player
    if (state.trackedPlayers.includes(playerName)) {
      const currentStats = state.playerStats[playerName] || { pts: 0, reb: 0, ast: 0 };
      const updates: Partial<PlayerStats> = {};
      
      // Points
      const ptsMatch = desc.match(/\((\d+)\s*PTS?\)/i);
      if (ptsMatch) {
        updates.pts = parseInt(ptsMatch[1]);
      }
      
      // Rebounds
      const rebMatch = desc.match(/Off:(\d+)\s+Def:(\d+)/i);
      if (rebMatch) {
        updates.reb = parseInt(rebMatch[1]) + parseInt(rebMatch[2]);
      }
      
      // Assists
      if (abbrName) {
        const astPattern = new RegExp(`\\(${abbrName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+(\\d+)\\s*AST\\)`, 'i');
        const astMatch = desc.match(astPattern);
        if (astMatch) {
          updates.ast = parseInt(astMatch[1]);
        }
      }
      
      if (Object.keys(updates).length > 0) {
        set((s) => ({
          playerStats: {
            ...s.playerStats,
            [playerName]: { ...currentStats, ...updates },
          },
        }));
      }
      
      // Check for substitution
      const descUpper = desc.toUpperCase();
      if (descUpper.includes('SUB IN') || descUpper.includes('ENTERS')) {
        set((s) => ({
          playerSubStatus: { ...s.playerSubStatus, [playerName]: 'in' },
        }));
      } else if (descUpper.includes('SUB OUT') || descUpper.includes('GOES TO BENCH')) {
        set((s) => ({
          playerSubStatus: { ...s.playerSubStatus, [playerName]: 'out' },
        }));
      }
    }
    
    // Check all tracked players for assists
    state.trackedPlayers.forEach((trackedPlayer) => {
      const lastNameParts = trackedPlayer.split(' ').slice(1);
      const lastName = lastNameParts.join(' ');
      const assistPattern = new RegExp(`\\([A-Z]\\.\\s+${lastName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+(\\d+)\\s*AST\\)`, 'i');
      const assistMatch = desc.match(assistPattern);
      
      if (assistMatch) {
        set((s) => ({
          playerStats: {
            ...s.playerStats,
            [trackedPlayer]: { ...s.playerStats[trackedPlayer], ast: parseInt(assistMatch[1]) },
          },
        }));
      }
    });
  },
  
  setPushToken: (token) => set({ pushToken: token }),
  
  isPlayerTracked: (player) => get().trackedPlayers.includes(player),
}));
