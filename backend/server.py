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

# Initialize FastAPI app
app = FastAPI(title="NBA Live Tracker API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Socket.IO with correct path for kubernetes ingress
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    ping_timeout=60,
    ping_interval=25
)

# Wrap with ASGI app - socket.io path set for /api prefix routing
socket_app = socketio.ASGIApp(sio, app, socketio_path='/socket.io')

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
            game_list.append({
                "label": f"{g['awayTeam']['teamTricode']} vs {g['homeTeam']['teamTricode']}",
                "game_id": g["gameId"],
                "status": g.get("gameStatusText", ""),
                "home_score": g['homeTeam'].get('score', 0),
                "away_score": g['awayTeam'].get('score', 0),
                "home_team": g['homeTeam']['teamTricode'],
                "away_team": g['awayTeam']['teamTricode'],
                "home_logo": nba_logos.get(g['homeTeam']['teamTricode'], ""),
                "away_logo": nba_logos.get(g['awayTeam']['teamTricode'], "")
            })
        return game_list
    except Exception as e:
        print(f"❌ Error fetching games: {e}")
        return []

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
                                points = int(pts_match.group(1))
                                await sio.emit('new_score', {
                                    'game_id': game_id,
                                    'description': desc,
                                    'period': period,
                                    'clock': clock,
                                    'action_id': action_number,
                                    'points': points,
                                    'player_name': full_player_name,
                                    'abbr_name': abbr_player_name
                                })
                                print(f"🏀 NEW SCORE: {desc}")

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
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "message": "🏀 NBA Live Tracker API is running!"}

@app.get("/api/games")
async def get_games():
    games = get_today_games()
    return {"games": games}

@app.get("/api/game/{game_id}")
async def get_game(game_id: str):
    events, actions = get_game_events(game_id)
    players, team_map = get_players_in_game(game_id)
    games = get_today_games()
    game_info = next((g for g in games if g['game_id'] == game_id), {})
    
    return {
        "game_id": game_id,
        "events": events[:30],
        "all_events": events,
        "players": players,
        "team_map": team_map,
        "home_team": game_info.get('home_team', ''),
        "away_team": game_info.get('away_team', ''),
        "home_logo": game_info.get('home_logo', ''),
        "away_logo": game_info.get('away_logo', '')
    }

@app.get("/api/logos")
async def get_logos():
    return nba_logos

# Start background task when app starts
@app.on_event("startup")
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
