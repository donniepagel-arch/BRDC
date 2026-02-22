// Shared dashboard state
export let currentPlayer = null;
export let dashboardData = null;

export function setCurrentPlayer(player) {
    currentPlayer = player;
}

export function setDashboardData(data) {
    dashboardData = data;
}
