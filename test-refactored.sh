#!/bin/bash

BASE_URL="https://us-central1-brdc-v2.cloudfunctions.net"

echo "=========================================="
echo "TESTING REFACTORED BRACKET SYSTEM"
echo "=========================================="

# Create tournament
echo "1. Creating tournament..."
TOURNAMENT_RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "tournament_name": "Friday Night Singles",
    "tournament_date": "2026-02-21",
    "email": "admin@brdc.com",
    "format": "single-elimination"
  }' \
  "$BASE_URL/createTournament")

TOURNAMENT_ID=$(echo $TOURNAMENT_RESPONSE | grep -o '"tournament_id":"[^"]*"' | cut -d'"' -f4)
echo "✓ Tournament: $TOURNAMENT_ID"

# Check in players WITH NAMES
echo ""
echo "2. Checking in 8 players..."
curl -s -X POST -H "Content-Type: application/json" \
  -d '{
    "tournamentId":"'$TOURNAMENT_ID'",
    "players":[
      {"id":"p1","name":"Alice"},
      {"id":"p2","name":"Bob"},
      {"id":"p3","name":"Charlie"},
      {"id":"p4","name":"Diana"},
      {"id":"p5","name":"Eve"},
      {"id":"p6","name":"Frank"},
      {"id":"p7","name":"Grace"},
      {"id":"p8","name":"Henry"}
    ]
  }' \
  "$BASE_URL/bulkCheckIn" | head -c 100

# Generate bracket
echo ""
echo ""
echo "3. Generating bracket..."
BRACKET_RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"tournament_id":"'$TOURNAMENT_ID'"}' \
  "$BASE_URL/generateBracket")

echo "$BRACKET_RESPONSE" | grep -o '"success":true'
MATCH_ID=$(echo $BRACKET_RESPONSE | grep -o '"id":"match-[0-9]*"' | head -1 | cut -d'"' -f4)
echo "✓ First match: $MATCH_ID"

# Submit result
echo ""
echo "4. Submitting match result..."
RESULT=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "tournament_id":"'$TOURNAMENT_ID'",
    "match_id":"'$MATCH_ID'",
    "player1_score":3,
    "player2_score":1
  }' \
  "$BASE_URL/submitMatchResult")

echo "$RESULT" | grep -o '"success":true' || echo "$RESULT"

echo ""
echo "=========================================="
echo "✅ COMPLETE! View at:"
echo "https://console.firebase.google.com/project/brdc-v2/firestore/data/tournaments/$TOURNAMENT_ID"
echo "=========================================="
