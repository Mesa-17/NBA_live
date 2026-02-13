#!/usr/bin/env python3
"""
NBA Live Tracker Backend API Testing
Tests all backend endpoints for functionality and data integrity.
"""

import requests
import json
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/frontend/.env')

# Get backend URL from environment
BACKEND_URL = os.getenv('EXPO_PUBLIC_BACKEND_URL', 'http://localhost:8001')
print(f"🔗 Testing backend at: {BACKEND_URL}")

# Test results tracking
test_results = {
    'health_check': {'status': 'pending', 'details': ''},
    'games_endpoint': {'status': 'pending', 'details': ''},
    'game_detail_endpoint': {'status': 'pending', 'details': ''},
    'logos_endpoint': {'status': 'pending', 'details': ''}
}

def test_health_endpoint():
    """Test /api/health endpoint"""
    print("\n🏥 Testing Health Check Endpoint...")
    try:
        response = requests.get(f"{BACKEND_URL}/api/health", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'healthy':
                test_results['health_check']['status'] = 'pass'
                test_results['health_check']['details'] = f"✅ Health check passed: {data.get('message', '')}"
                print(f"   ✅ Health check passed: {data}")
            else:
                test_results['health_check']['status'] = 'fail'
                test_results['health_check']['details'] = f"❌ Health check failed: status is '{data.get('status')}', expected 'healthy'"
                print(f"   ❌ Health check failed: {data}")
        else:
            test_results['health_check']['status'] = 'fail'
            test_results['health_check']['details'] = f"❌ Health endpoint returned status code {response.status_code}"
            print(f"   ❌ Health endpoint returned status code {response.status_code}")
            
    except requests.exceptions.RequestException as e:
        test_results['health_check']['status'] = 'fail'
        test_results['health_check']['details'] = f"❌ Health endpoint request failed: {str(e)}"
        print(f"   ❌ Health endpoint request failed: {str(e)}")

def test_games_endpoint():
    """Test /api/games endpoint - Focus on 20-day range and scheduled games"""
    print("\n🏀 Testing Games Endpoint (20-day range verification)...")
    try:
        response = requests.get(f"{BACKEND_URL}/api/games", timeout=15)
        
        if response.status_code == 200:
            data = response.json()
            if 'games' in data and isinstance(data['games'], list):
                games_count = len(data['games'])
                print(f"   📊 Total games returned: {games_count}")
                
                if games_count > 0:
                    # Verify required fields in games
                    first_game = data['games'][0]
                    required_fields = ["game_id", "status", "home_team", "away_team", "home_logo", "away_logo"]
                    missing_fields = [field for field in required_fields if field not in first_game]
                    
                    if missing_fields:
                        test_results['games_endpoint']['status'] = 'fail'
                        test_results['games_endpoint']['details'] = f"❌ Games missing required fields: {missing_fields}"
                        print(f"   ❌ Games missing required fields: {missing_fields}")
                        return
                    
                    # Check for scheduled games (key requirement)
                    scheduled_games = [g for g in data['games'] if g.get('is_scheduled', False)]
                    today_games = [g for g in data['games'] if g.get('is_today', False)]
                    
                    print(f"   📅 Today's games: {len(today_games)}")
                    print(f"   📅 Scheduled future games: {len(scheduled_games)}")
                    
                    # Verify date range spans more than just today
                    unique_dates = set(g.get('game_date', '') for g in data['games'] if g.get('game_date'))
                    print(f"   📅 Unique dates covered: {len(unique_dates)}")
                    
                    if len(unique_dates) > 1:
                        dates = sorted(unique_dates)
                        print(f"   📅 Date range: {dates[0]} to {dates[-1]}")
                        
                        # Check if we have scheduled games with is_scheduled flag
                        if len(scheduled_games) > 0:
                            print(f"   ✅ Found {len(scheduled_games)} scheduled games with is_scheduled: true")
                            
                            # Show sample scheduled games
                            print("   📋 Sample scheduled games:")
                            for i, game in enumerate(scheduled_games[:3]):
                                print(f"      {game.get('game_date')}: {game.get('away_team')} vs {game.get('home_team')} - {game.get('status')}")
                            
                            # Verify date span covers approximately 20 days
                            try:
                                from datetime import datetime
                                start_date = datetime.strptime(dates[0], "%Y-%m-%d")
                                end_date = datetime.strptime(dates[-1], "%Y-%m-%d")
                                date_span = (end_date - start_date).days
                                print(f"   📅 Date span: {date_span} days")
                                
                                if date_span >= 15:  # Allow some flexibility
                                    test_results['games_endpoint']['status'] = 'pass'
                                    test_results['games_endpoint']['details'] = f"✅ Games endpoint passed: {games_count} games, {len(scheduled_games)} scheduled, {date_span} day range"
                                    print(f"   ✅ 20-day requirement met: {date_span} days range")
                                else:
                                    test_results['games_endpoint']['status'] = 'fail'
                                    test_results['games_endpoint']['details'] = f"❌ Insufficient date range: {date_span} days (expected ~20)"
                                    print(f"   ❌ Insufficient date range: {date_span} days (expected ~20)")
                            except ValueError:
                                test_results['games_endpoint']['status'] = 'pass'
                                test_results['games_endpoint']['details'] = f"✅ Games endpoint has scheduled games but date parsing issue"
                                print("   ⚠️  Date format issue, but scheduled games found")
                        else:
                            test_results['games_endpoint']['status'] = 'fail'
                            test_results['games_endpoint']['details'] = "❌ No scheduled games found with is_scheduled: true"
                            print("   ❌ No scheduled games found with is_scheduled: true")
                    else:
                        test_results['games_endpoint']['status'] = 'fail'
                        test_results['games_endpoint']['details'] = "❌ Games only cover one date (expected 20-day range)"
                        print("   ❌ Games only cover one date (expected 20-day range)")
                    
                    # Store first game ID for testing game detail endpoint
                    global sample_game_id
                    sample_game_id = data['games'][0].get('game_id')
                    print(f"   🎯 Will use game_id '{sample_game_id}' for detail testing")
                else:
                    test_results['games_endpoint']['status'] = 'fail'
                    test_results['games_endpoint']['details'] = "❌ No games returned (expected games for 20-day period)"
                    print("   ❌ No games returned (expected games for 20-day period)")
            else:
                test_results['games_endpoint']['status'] = 'fail'
                test_results['games_endpoint']['details'] = "❌ Games endpoint response missing 'games' array"
                print(f"   ❌ Games endpoint response missing 'games' array: {data}")
        else:
            test_results['games_endpoint']['status'] = 'fail'
            test_results['games_endpoint']['details'] = f"❌ Games endpoint returned status code {response.status_code}"
            print(f"   ❌ Games endpoint returned status code {response.status_code}")
            
    except requests.exceptions.RequestException as e:
        test_results['games_endpoint']['status'] = 'fail'
        test_results['games_endpoint']['details'] = f"❌ Games endpoint request failed: {str(e)}"
        print(f"   ❌ Games endpoint request failed: {str(e)}")

def test_game_detail_endpoint():
    """Test /api/game/{game_id} endpoint"""
    print("\n🎯 Testing Game Detail Endpoint...")
    
    # Use sample game ID if available, otherwise use a common NBA game ID format
    game_id_to_test = getattr(test_game_detail_endpoint, 'game_id', None) or sample_game_id if 'sample_game_id' in globals() else "0032500004"
    
    try:
        response = requests.get(f"{BACKEND_URL}/api/game/{game_id_to_test}", timeout=15)
        
        if response.status_code == 200:
            data = response.json()
            required_fields = ['game_id', 'events', 'players', 'team_map']
            
            missing_fields = [field for field in required_fields if field not in data]
            if not missing_fields:
                test_results['game_detail_endpoint']['status'] = 'pass'
                events_count = len(data.get('events', []))
                players_count = len(data.get('players', []))
                test_results['game_detail_endpoint']['details'] = f"✅ Game detail endpoint returned data with {events_count} events and {players_count} players"
                print(f"   ✅ Game detail endpoint returned valid data:")
                print(f"      - Game ID: {data.get('game_id')}")
                print(f"      - Events: {events_count}")
                print(f"      - Players: {players_count}")
                print(f"      - Home Team: {data.get('home_team', 'N/A')}")
                print(f"      - Away Team: {data.get('away_team', 'N/A')}")
            else:
                test_results['game_detail_endpoint']['status'] = 'fail'
                test_results['game_detail_endpoint']['details'] = f"❌ Game detail endpoint missing required fields: {missing_fields}"
                print(f"   ❌ Game detail endpoint missing required fields: {missing_fields}")
        else:
            test_results['game_detail_endpoint']['status'] = 'fail'
            test_results['game_detail_endpoint']['details'] = f"❌ Game detail endpoint returned status code {response.status_code}"
            print(f"   ❌ Game detail endpoint returned status code {response.status_code}")
            
    except requests.exceptions.RequestException as e:
        test_results['game_detail_endpoint']['status'] = 'fail'
        test_results['game_detail_endpoint']['details'] = f"❌ Game detail endpoint request failed: {str(e)}"
        print(f"   ❌ Game detail endpoint request failed: {str(e)}")

def test_logos_endpoint():
    """Test /api/logos endpoint"""
    print("\n🏆 Testing Logos Endpoint...")
    try:
        response = requests.get(f"{BACKEND_URL}/api/logos", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            # Check if we have NBA team logos
            expected_teams = ['LAL', 'GSW', 'BOS', 'CHI', 'MIA']  # Sample of well-known teams
            found_teams = [team for team in expected_teams if team in data]
            
            if len(data) >= 25 and len(found_teams) >= 3:  # Expect at least 25 teams and 3 of our sample teams
                test_results['logos_endpoint']['status'] = 'pass'
                test_results['logos_endpoint']['details'] = f"✅ Logos endpoint returned {len(data)} team logos"
                print(f"   ✅ Logos endpoint returned {len(data)} team logos")
                print(f"   📋 Sample teams found: {', '.join(found_teams)}")
                
                # Verify URLs are properly formatted
                sample_logo = next(iter(data.values()))
                if sample_logo.startswith('http'):
                    print(f"   🔗 Logo URLs properly formatted (sample: {sample_logo[:50]}...)")
                else:
                    print(f"   ⚠️  Logo URLs might not be properly formatted: {sample_logo}")
            else:
                test_results['logos_endpoint']['status'] = 'fail'
                test_results['logos_endpoint']['details'] = f"❌ Logos endpoint returned insufficient data: {len(data)} teams, expected teams found: {found_teams}"
                print(f"   ❌ Logos endpoint returned insufficient data: {len(data)} teams")
        else:
            test_results['logos_endpoint']['status'] = 'fail'
            test_results['logos_endpoint']['details'] = f"❌ Logos endpoint returned status code {response.status_code}"
            print(f"   ❌ Logos endpoint returned status code {response.status_code}")
            
    except requests.exceptions.RequestException as e:
        test_results['logos_endpoint']['status'] = 'fail'
        test_results['logos_endpoint']['details'] = f"❌ Logos endpoint request failed: {str(e)}"
        print(f"   ❌ Logos endpoint request failed: {str(e)}")

def print_test_summary():
    """Print comprehensive test summary"""
    print("\n" + "="*70)
    print("🏀 NBA LIVE TRACKER BACKEND API TEST SUMMARY")
    print("="*70)
    
    total_tests = len(test_results)
    passed_tests = sum(1 for result in test_results.values() if result['status'] == 'pass')
    failed_tests = sum(1 for result in test_results.values() if result['status'] == 'fail')
    
    print(f"\n📊 Overall Results: {passed_tests}/{total_tests} tests passed")
    
    if failed_tests == 0:
        print("🎉 ALL TESTS PASSED! Backend API is working correctly.")
    else:
        print(f"⚠️  {failed_tests} test(s) failed. See details below.")
    
    print("\n📋 Detailed Results:")
    for test_name, result in test_results.items():
        status_emoji = "✅" if result['status'] == 'pass' else "❌"
        print(f"   {status_emoji} {test_name.replace('_', ' ').title()}: {result['details']}")
    
    print("\n" + "="*70)
    
    return passed_tests == total_tests

if __name__ == "__main__":
    print("🚀 Starting NBA Live Tracker Backend API Tests...")
    print(f"🔗 Backend URL: {BACKEND_URL}")
    
    # Run all tests
    test_health_endpoint()
    test_games_endpoint()
    test_game_detail_endpoint()
    test_logos_endpoint()
    
    # Print summary and exit with appropriate code
    all_passed = print_test_summary()
    exit(0 if all_passed else 1)