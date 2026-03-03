from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import socketio
import asyncio
import re
import os
from dotenv import load_dotenv
from pymongo import MongoClient
from datetime import datetime

load_dotenv()

# Initialize FastAPI app (internal - wrapped by socket.io)
fastapi_app = FastAPI(title="NBA Live Tracker API")

# Add CORS middleware
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Socket.IO
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    ping_timeout=60,
    ping_interval=25,
)

# Wrap with ASGI app - 'app' is what uvicorn runs via supervisord
# socketio_path must start with / for proper routing
app = socketio.ASGIApp(sio, fastapi_app, socketio_path='/api/socket.io')

# MongoDB connection
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "nba_tracker")
client = MongoClient(MONGO_URL)
db = client[DB_NAME]

# NBA Team Logos
nba_logos = {
    "ATL": "https://loodibee.com/wp-content/uploads/nba-atlanta-hawks-logo.png",
    "BOS": "https://loodibee.com/wp-content/uploads/nba-boston-celtics-logo.png",
    "BKN": "https://loodibee.com/wp-content/uploads/nba-brooklyn-nets-logo.png",
    "CHA": "https://loodibee.com/wp-content/uploads/nba-charlotte-hornets-logo.png",
    "CHI": "https://loodibee.com/wp-content/uploads/nba-chicago-bulls-logo.png",
    "CLE": "https://loodibee.com/wp-content/uploads/nba-cleveland-cavaliers-logo.png",
    "DAL": "https://loodibee.com/wp-content/uploads/nba-dallas-mavericks-logo.png",
    "DEN": "https://loodibee.com/wp-content/uploads/nba-denver-nuggets-logo.png",
    "DET": "https://loodibee.com/wp-content/uploads/nba-detroit-pistons-logo.png",
    "GSW": "https://loodibee.com/wp-content/uploads/nba-golden-state-warriors-logo.png",
    "HOU": "https://loodibee.com/wp-content/uploads/nba-houston-rockets-logo.png",
    "IND": "https://loodibee.com/wp-content/uploads/nba-indiana-pacers-logo.png",
    "LAC": "https://loodibee.com/wp-content/uploads/nba-los-angeles-clippers-logo.png",
    "LAL": "https://loodibee.com/wp-content/uploads/nba-los-angeles-lakers-logo.png",
    "MEM": "https://loodibee.com/wp-content/uploads/nba-memphis-grizzlies-logo.png",
    "MIA": "https://loodibee.com/wp-content/uploads/nba-miami-heat-logo.png",
    "MIL": "https://loodibee.com/wp-content/uploads/nba-milwaukee-bucks-logo.png",
    "MIN": "https://loodibee.com/wp-content/uploads/nba-minnesota-timberwolves-logo.png",
    "NOP": "https://loodibee.com/wp-content/uploads/nba-new-orleans-pelicans-logo.png",
    "NYK": "https://loodibee.com/wp-content/uploads/nba-new-york-knicks-logo.png",
    "OKC": "https://loodibee.com/wp-content/uploads/nba-oklahoma-city-thunder-logo.png",
    "ORL": "https://loodibee.com/wp-content/uploads/nba-orlando-magic-logo.png",
    "PHI": "https://loodibee.com/wp-content/uploads/nba-philadelphia-76ers-logo.png",
    "PHX": "https://loodibee.com/wp-content/uploads/nba-phoenix-suns-logo.png",
    "POR": "https://loodibee.com/wp-content/uploads/nba-portland-trail-blazers-logo.png",
    "SAC": "https://loodibee.com/wp-content/uploads/nba-sacramento-kings-logo.png",
    "SAS": "https://loodibee.com/wp-content/uploads/nba-san-antonio-spurs-logo.png",
    "TOR": "https://loodibee.com/wp-content/uploads/nba-toronto-raptors-logo.png",
    "UTA": "https://loodibee.com/wp-content/uploads/nba-utah-jazz-logo.png",
    "WAS": "https://loodibee.com/wp-content/uploads/nba-washington-wizards-logo.png"
}

# Track last action IDs per game
last_action_tracker = {}

# Track connected clients and their tracked players
tracked_players_by_client = {}
push_tokens = {}

def format_clock(clock_str):
    """Format clock string from NBA API"""
    if not clock_str:
        return "00:00"
    match = re.match(r"PT(\d+)M(\d+)\.?(\d*)S", clock_str)
    if match:
        m, s, ms = match.groups()
        return f"{m.zfill(2)}:{s.zfill(2)}"
    return clock_str

def get_today_games():
    """Fetch today's NBA games"""
    try:
        from nba_api.live.nba.endpoints import scoreboard
        games = scoreboard.ScoreBoard().get_dict()["scoreboard"]["games"]
        game_list = []
        for g in games:
            status_text = g.get("gameStatusText", "")
            game_status = g.get("gameStatus", 1)
            
            # Determine if game is live (status 2 = in progress)
            is_live = game_status == 2
            
            game_list.append({
                "label": f"{g['awayTeam']['teamTricode']} vs {g['homeTeam']['teamTricode']}",
                "game_id": g["gameId"],
                "status": status_text,
                "home_score": g['homeTeam'].get('score', 0),
                "away_score": g['awayTeam'].get('score', 0),
                "home_team": g['homeTeam']['teamTricode'],
                "away_team": g['awayTeam']['teamTricode'],
                "home_logo": nba_logos.get(g['homeTeam']['teamTricode'], ""),
                "away_logo": nba_logos.get(g['awayTeam']['teamTricode'], ""),
                "game_date": datetime.now().strftime("%Y-%m-%d"),
                "is_today": True,
                "is_live": is_live,
                "is_scheduled": game_status == 1
            })
        return game_list
    except Exception as e:
        print(f"❌ Error fetching games: {e}")
        return []

def get_scheduled_games(days=20):
    """Fetch real NBA schedule for next N days"""
    try:
        import requests
        from datetime import timedelta
        
        all_games = []
        today = datetime.now()
        
        # First get today's games from live API
        today_games = get_today_games()
        all_games.extend(today_games)
        
        # Fetch real NBA schedule from official endpoint
        try:
            schedule_url = f"https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json"
            response = requests.get(schedule_url, timeout=10, headers={
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'application/json',
                'Referer': 'https://www.nba.com/'
            })
            
            if response.status_code == 200:
                schedule_data = response.json()
                game_dates = schedule_data.get('leagueSchedule', {}).get('gameDates', [])
                
                end_date = today + timedelta(days=days)
                
                for game_date_entry in game_dates:
                    for game in game_date_entry.get('games', []):
                        home_team_data = game.get('homeTeam', {})
                        away_team_data = game.get('awayTeam', {})
                        
                        home_team = home_team_data.get('teamTricode', '')
                        away_team = away_team_data.get('teamTricode', '')
                        
                        # Get game time and use it for the actual date
                        game_time_utc = game.get('gameDateTimeUTC', '')
                        try:
                            game_dt = datetime.strptime(game_time_utc, "%Y-%m-%dT%H:%M:%SZ")
                            # Convert to ET (UTC-5)
                            game_dt_et = game_dt - timedelta(hours=5)
                            time_str = game_dt_et.strftime("%I:%M %p ET").lstrip('0')
                            # Use the ET date as the game date
                            date_str = game_dt_et.strftime("%Y-%m-%d")
                            display_date = game_dt_et.strftime("%b %d")
                        except:
                            time_str = "TBD"
                            continue  # Skip if we can't parse the date
                        
                        # Only include future games within our range
                        if game_dt_et.date() <= today.date() or game_dt_et > end_date:
                            continue
                        
                        game_status = game.get('gameStatus', 1)
                        status_text = game.get('gameStatusText', '')
                        
                        # Determine if game is live
                        is_live = game_status == 2
                        
                        if game_status == 1:
                            status_display = f"{display_date} • {time_str}"
                        elif game_status == 2:
                            status_display = status_text or "LIVE"
                        else:
                            status_display = "Final"
                        
                        all_games.append({
                            "label": f"{away_team} vs {home_team}",
                            "game_id": game.get('gameId', f"future_{date_str}_{len(all_games)}"),
                            "status": status_display,
                            "home_score": home_team_data.get('score', 0),
                            "away_score": away_team_data.get('score', 0),
                            "home_team": home_team,
                            "away_team": away_team,
                            "home_logo": nba_logos.get(home_team, ""),
                            "away_logo": nba_logos.get(away_team, ""),
                            "game_date": date_str,
                            "is_today": False,
                            "is_scheduled": game_status == 1,
                            "is_live": is_live
                        })
                
                print(f"✅ Loaded {len(all_games)} games from NBA schedule")
                return all_games
                
        except Exception as e:
            print(f"⚠️ Could not fetch NBA schedule: {e}")
        
        # Fallback: return only today's games if schedule fetch fails
        return today_games
        
    except Exception as e:
        print(f"❌ Error fetching scheduled games: {e}")
        return get_today_games()

def get_players_in_game(game_id):
    """Fetch players in a game"""
    try:
        from nba_api.live.nba.endpoints import boxscore
        bs = boxscore.BoxScore(game_id=game_id).get_dict()
        if "game" not in bs or not bs["game"]:
            return [], {}

        players = []
        team_map = {}

        for team_key in ['homeTeam', 'awayTeam']:
            team_name = bs['game'][team_key]['teamTricode']
            for player in bs['game'][team_key].get('players', []):
                full_name = player['name']
                players.append(full_name)
                team_map[full_name] = team_name

        return sorted(players), team_map
    except Exception as e:
        print(f"❌ Error fetching players for game {game_id}: {e}")
        return [], {}

def get_game_events(game_id):
    """Fetch play-by-play events"""
    try:
        from nba_api.live.nba.endpoints import playbyplay
        pbp = playbyplay.PlayByPlay(game_id=game_id).get_dict()
        actions = pbp["game"]["actions"]

        all_events = []
        for action in actions:
            desc = action.get("description", "")
            period = action["period"]
            clock = format_clock(action["clock"])
            score_home = action.get("scoreHome", "")
            score_away = action.get("scoreAway", "")
            action_id = action.get("actionNumber", 0)

            event = {
                "text": f"[Q{period}] {clock} - {desc} | Score: {score_away} - {score_home}",
                "description": desc,
                "period": period,
                "clock": clock,
                "score_home": score_home,
                "score_away": score_away,
                "action_id": action_id
            }
            all_events.insert(0, event)

        return all_events, actions
    except Exception as e:
        print(f"❌ Error fetching events for game {game_id}: {e}")
        return [], []

async def background_nba_data():
    """Background task to fetch NBA data"""
    print("🏀 NBA data streaming started!")
    global last_action_tracker
    
    while True:
        await asyncio.sleep(5)
        
        try:
            games = get_today_games()
            await sio.emit('games_update', {'games': games})
            print(f"📤 Emitted {len(games)} games")

            for game in games:
                game_id = game['game_id']
                events, actions = get_game_events(game_id)
                players, team_map = get_players_in_game(game_id)

                # Emit game data
                await sio.emit('game_data', {
                    'game_id': game_id,
                    'events': events[:30],
                    'all_events': events,
                    'players': players,
                    'team_map': team_map,
                    'home_team': game['home_team'],
                    'away_team': game['away_team'],
                    'home_logo': game['home_logo'],
                    'away_logo': game['away_logo']
                })

                last_action_id = last_action_tracker.get(game_id, 0)

                if actions:
                    current_last_action = actions[-1].get('actionNumber', 0)

                    if last_action_id > 0 and current_last_action > last_action_id:
                        new_actions = [a for a in actions if a.get('actionNumber', 0) > last_action_id]

                        for action in new_actions:
                            desc = action.get("description", "")
                            period = action.get("period", "")
                            clock = format_clock(action.get("clock", ""))
                            action_number = action.get("actionNumber", 0)

                            # Extract player name
                            abbr_player_name = None
                            full_player_name = None

                            if re.search(r"SUB\s+(?:in|out):", desc, re.IGNORECASE):
                                sub_match = re.search(r"SUB\s+(?:in|out):\s+([A-Z]\.\s+[A-Za-z\s\-'\.]+)", desc, re.IGNORECASE)
                                if sub_match:
                                    abbr_player_name = sub_match.group(1).strip()
                            else:
                                player_match = re.match(r"([A-Z]\.\s+[A-Za-z\s\-'\.]+?)(?:\s)", desc)
                                abbr_player_name = player_match.group(1).strip() if player_match else None

                            if abbr_player_name:
                                abbr_parts = abbr_player_name.split()
                                if len(abbr_parts) >= 2:
                                    abbr_last_name = ' '.join(abbr_parts[1:])
                                    for player in players:
                                        if abbr_last_name in player:
                                            full_player_name = player
                                            break

                            if full_player_name:
                                await sio.emit('player_action', {
                                    'game_id': game_id,
                                    'description': desc,
                                    'period': period,
                                    'clock': clock,
                                    'action_id': action_number,
                                    'player_name': full_player_name,
                                    'abbr_name': abbr_player_name
                                })

                            pts_match = re.search(r"\((\d+)\s*PTS?\)", desc, re.IGNORECASE)
                            if pts_match and full_player_name:
                                total_points = int(pts_match.group(1))
                                # Get current game score
                                score_home = action.get("scoreHome", "0")
                                score_away = action.get("scoreAway", "0")
                                
                                await sio.emit('new_score', {
                                    'game_id': game_id,
                                    'description': desc,
                                    'period': period,
                                    'clock': clock,
                                    'action_id': action_number,
                                    'total_points': total_points,
                                    'player_name': full_player_name,
                                    'abbr_name': abbr_player_name,
                                    'score_home': score_home,
                                    'score_away': score_away,
                                    'home_team': game['home_team'],
                                    'away_team': game['away_team']
                                })
                                print(f"🏀 NEW SCORE: {full_player_name} now has {total_points} PTS - {desc}")

                    last_action_tracker[game_id] = current_last_action

        except Exception as e:
            print(f"❌ Error in background: {e}")

# Socket.IO Events
@sio.event
async def connect(sid, environ):
    print(f"✅ Client connected: {sid}")
    tracked_players_by_client[sid] = set()
    await sio.emit('connection_status', {'status': 'connected', 'message': 'Connected to NBA Live Server'}, to=sid)

@sio.event
async def disconnect(sid):
    print(f"❌ Client disconnected: {sid}")
    if sid in tracked_players_by_client:
        del tracked_players_by_client[sid]
    if sid in push_tokens:
        del push_tokens[sid]

@sio.event
async def register_push_token(sid, data):
    """Register push notification token"""
    token = data.get('token')
    if token:
        push_tokens[sid] = token
        print(f"📱 Push token registered for {sid}")

@sio.event
async def track_player(sid, data):
    """Track a player for notifications"""
    player_name = data.get('player_name')
    if player_name and sid in tracked_players_by_client:
        tracked_players_by_client[sid].add(player_name)
        print(f"🔔 {sid} now tracking: {player_name}")

@sio.event
async def untrack_player(sid, data):
    """Stop tracking a player"""
    player_name = data.get('player_name')
    if player_name and sid in tracked_players_by_client:
        tracked_players_by_client[sid].discard(player_name)
        print(f"🔕 {sid} stopped tracking: {player_name}")

@sio.event
async def request_games(sid, data):
    """Send games list to client"""
    games = get_today_games()
    await sio.emit('games_update', {'games': games}, to=sid)

@sio.event
async def request_game_data(sid, data):
    """Send game data to client"""
    game_id = data.get('game_id')
    if game_id:
        events, actions = get_game_events(game_id)
        players, team_map = get_players_in_game(game_id)
        games = get_today_games()
        game_info = next((g for g in games if g['game_id'] == game_id), {})
        
        await sio.emit('game_data', {
            'game_id': game_id,
            'events': events[:30],
            'all_events': events,
            'players': players,
            'team_map': team_map,
            'home_team': game_info.get('home_team', ''),
            'away_team': game_info.get('away_team', ''),
            'home_logo': game_info.get('home_logo', ''),
            'away_logo': game_info.get('away_logo', '')
        }, to=sid)

# REST API Endpoints
@fastapi_app.get("/api/health")
async def health_check():
    return {"status": "healthy", "message": "🏀 NBA Live Tracker API is running!"}

@fastapi_app.get("/api/games")
async def get_games():
    """Get all games including future scheduled games up to 20 days"""
    games = get_scheduled_games(days=20)
    return {"games": games}

@fastapi_app.get("/api/game/{game_id}")
async def get_game(game_id: str):
    events, actions = get_game_events(game_id)
    players, team_map = get_players_in_game(game_id)
    
    # Look for game info in both today's games and scheduled games
    all_games = get_scheduled_games(days=20)
    game_info = next((g for g in all_games if g['game_id'] == game_id), {})
    
    return {
        "game_id": game_id,
        "events": events[:30],
        "all_events": events,
        "players": players,
        "team_map": team_map,
        "home_team": game_info.get('home_team', ''),
        "away_team": game_info.get('away_team', ''),
        "home_logo": game_info.get('home_logo', ''),
        "away_logo": game_info.get('away_logo', ''),
        "is_scheduled": game_info.get('is_scheduled', False),
        "is_live": game_info.get('is_live', False),
        "status": game_info.get('status', '')
    }

@fastapi_app.get("/api/logos")
async def get_logos():
    return nba_logos

# Start background task when app starts
@fastapi_app.on_event("startup")
async def startup_event():
    print("🚀 Starting NBA Live Tracker Server...")
    games = get_today_games()
    print(f"🏀 Found {len(games)} games today")
    for g in games:
        print(f"   {g['away_team']} vs {g['home_team']} - {g['status']}")
    asyncio.create_task(background_nba_data())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(socket_app, host="0.0.0.0", port=8001)
