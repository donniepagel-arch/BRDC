// BRDC Reusable Components - All 6 in one file

// ==================== BRACKET DISPLAY ====================
export function BracketDisplay({ matches, event, tournament }) {
  const rounds = {};
  matches.forEach(m => {
    if (!rounds[m.round]) rounds[m.round] = [];
    rounds[m.round].push(m);
  });

  const roundOrder = Object.keys(rounds).sort((a, b) => {
    const order = ['R1', 'R2', 'R3', 'QF', 'SF', 'F', 'WB_R1', 'WB_SF', 'WB_F', 'LB_R1', 'LB_SF', 'LB_F', 'GF'];
    return order.indexOf(a) - order.indexOf(b);
  });

  return `
    <div class="bracket-header">
      <h1>${event.event_name}</h1>
      <p>${tournament.tournament_name} • ${formatDate(tournament.tournament_date)}</p>
    </div>
    <div class="bracket-container">
      ${roundOrder.map(round => `
        <div class="round-column">
          <div class="round-title">${formatRound(round)}</div>
          ${rounds[round].map(m => `
            <div class="match-card ${m.status === 'completed' ? 'completed' : ''}">
              <div class="match-info">
                <span>Match ${m.match_no}</span>
                ${m.board_no ? `<span class="board">Board ${m.board_no}</span>` : ''}
              </div>
              <div class="player ${m.winner_player_id === m.p1_player_id ? 'winner' : ''}">
                <span>${m.p1_name}</span>
                ${m.p1_legs_won != null ? `<span class="score">${m.p1_legs_won}</span>` : ''}
              </div>
              <div class="player ${m.winner_player_id === m.p2_player_id ? 'winner' : ''}">
                <span>${m.p2_name}</span>
                ${m.p2_legs_won != null ? `<span class="score">${m.p2_legs_won}</span>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      `).join('')}
    </div>
  `;
}

// ==================== REGISTRATION FORM ====================
export function RegistrationForm({ event, tournament }) {
  return `
    <div class="reg-header">
      <h1>${event.event_name}</h1>
      <p>${tournament.tournament_name} • $${event.entry_fee}</p>
    </div>
    <form id="registrationForm" class="reg-form">
      <input type="text" name="full_name" placeholder="Full Name" required>
      <input type="email" name="email" placeholder="Email" required>
      <input type="tel" name="phone" placeholder="Phone (optional)">
      <label><input type="checkbox" name="sms_opt_in" checked> Send SMS updates</label>
      <button type="submit" class="btn-primary">
        ${event.entry_fee > 0 ? 'Continue to Payment' : 'Register Now'}
      </button>
    </form>
  `;
}

// ==================== EVENT CARD ====================
export function EventCard({ event, tournament }) {
  return `
    <div class="event-card">
      <h3>${event.event_name}</h3>
      <div class="event-meta">
        <span>🎯 ${event.game}</span>
        <span>🏆 ${formatFormat(event.format)}</span>
        <span>💰 $${event.entry_fee}</span>
      </div>
      ${event.start_time ? `<p>⏰ ${event.start_time}</p>` : ''}
      <div class="event-actions">
        <a href="/register?event_id=${event.event_id}" class="btn-primary">Register</a>
        ${event.status === 'in_progress' ? `<a href="/bracket?event_id=${event.event_id}" class="btn-secondary">View Bracket</a>` : ''}
      </div>
    </div>
  `;
}

// ==================== MATCH CARD ====================
export function MatchCard({ match }) {
  return `
    <div class="match-card ${match.status}">
      <div class="match-header">
        <span class="round">${formatRound(match.round)}</span>
        ${match.board_no ? `<span class="board">Board ${match.board_no}</span>` : ''}
      </div>
      <div class="players">
        <div class="player ${match.winner_player_id === match.p1_player_id ? 'winner' : ''}">
          ${match.p1_name} ${match.p1_legs_won != null ? `<span class="score">${match.p1_legs_won}</span>` : ''}
        </div>
        <div class="vs">VS</div>
        <div class="player ${match.winner_player_id === match.p2_player_id ? 'winner' : ''}">
          ${match.p2_name} ${match.p2_legs_won != null ? `<span class="score">${match.p2_legs_won}</span>` : ''}
        </div>
      </div>
      <div class="status-badge ${match.status}">${match.status.toUpperCase()}</div>
    </div>
  `;
}

// ==================== STANDINGS TABLE ====================
export function StandingsTable({ teams }) {
  const sorted = [...teams].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return (b.points_for - b.points_against) - (a.points_for - a.points_against);
  });

  return `
    <table class="standings-table">
      <thead>
        <tr>
          <th>Pos</th>
          <th>Team</th>
          <th>W</th>
          <th>L</th>
          <th>PF</th>
          <th>PA</th>
          <th>Diff</th>
        </tr>
      </thead>
      <tbody>
        ${sorted.map((team, i) => `
          <tr>
            <td>${i + 1}</td>
            <td><strong>${team.team_name}</strong></td>
            <td>${team.wins}</td>
            <td>${team.losses}</td>
            <td>${team.points_for}</td>
            <td>${team.points_against}</td>
            <td>${team.points_for - team.points_against > 0 ? '+' : ''}${team.points_for - team.points_against}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// ==================== PAYPAL BUTTON ====================
export function PayPalButton({ amount, regId, onSuccess }) {
  return `
    <div id="paypal-button-container"></div>
    <script src="https://www.paypal.com/sdk/js?client-id=YOUR_CLIENT_ID&currency=USD"></script>
    <script>
      paypal.Buttons({
        createOrder: async () => {
          const res = await fetch('/api/create-payment', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ reg_id: '${regId}', amount: ${amount} })
          });
          const data = await res.json();
          return data.order_id;
        },
        onApprove: async (data) => {
          const res = await fetch('/api/capture-payment', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ order_id: data.orderID, reg_id: '${regId}' })
          });
          const result = await res.json();
          if (result.success) ${onSuccess}();
        }
      }).render('#paypal-button-container');
    </script>
  `;
}

// ==================== HELPER FUNCTIONS ====================
function formatRound(round) {
  const map = {
    'R1': 'Round 1', 'R2': 'Round 2', 'QF': 'Quarter Finals', 'SF': 'Semi Finals', 'F': 'Finals',
    'WB_R1': 'Winners R1', 'WB_SF': 'Winners SF', 'WB_F': 'Winners Final',
    'LB_R1': 'Losers R1', 'LB_SF': 'Losers SF', 'LB_F': 'Losers Final', 'GF': 'Grand Finals'
  };
  return map[round] || round;
}

function formatFormat(format) {
  const map = {
    'single_elim': 'Single Elimination', 'double_elim': 'Double Elimination',
    'round_robin': 'Round Robin', 'swiss': 'Swiss System'
  };
  return map[format] || format;
}

function formatDate(timestamp) {
  return new Date(timestamp.seconds * 1000).toLocaleDateString();
}
