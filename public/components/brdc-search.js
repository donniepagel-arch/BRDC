/**
 * BRDC Global Search Component
 * Search across leagues, players, matches, events
 */

class BRDCSearch {
    constructor() {
        this.searchIndex = {
            leagues: [],
            players: [],
            events: [],
            teams: []
        };
        this.isOpen = false;
    }

    /**
     * Initialize search component
     */
    async init() {
        this.renderSearchButton();
        this.renderSearchModal();
        this.attachEventListeners();

        // Load search index in background
        this.buildSearchIndex();
    }

    /**
     * Render search button (desktop header or mobile)
     */
    renderSearchButton() {
        const btn = document.createElement('button');
        btn.id = 'brdcSearchBtn';
        btn.className = 'brdc-search-btn';
        btn.innerHTML = '<span class="search-icon">🔍</span><span class="search-label">Search</span>';
        btn.onclick = () => this.openSearch();

        // Insert into header or create floating button
        const header = document.querySelector('.brdc-desktop-nav') || document.querySelector('.fb-header');
        if (header) {
            header.appendChild(btn);
        } else {
            // Floating search button
            btn.classList.add('floating');
            document.body.appendChild(btn);
        }
    }

    /**
     * Render search modal
     */
    renderSearchModal() {
        const modal = document.createElement('div');
        modal.id = 'brdcSearchModal';
        modal.className = 'brdc-search-modal';
        modal.innerHTML = `
            <div class="search-modal-backdrop" onclick="window.brdcSearch.closeSearch()"></div>
            <div class="search-modal-content">
                <div class="search-modal-header">
                    <input type="text"
                           id="brdcSearchInput"
                           class="search-input"
                           placeholder="Search leagues, players, events..."
                           autocomplete="off">
                    <button class="search-close-btn" onclick="window.brdcSearch.closeSearch()">✕</button>
                </div>
                <div class="search-modal-body">
                    <div id="brdcSearchResults" class="search-results"></div>
                </div>
                <div class="search-modal-footer">
                    <span class="search-tip">💡 Tip: Search by name, league, or team</span>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Keyboard shortcut: Cmd/Ctrl + K
        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                this.openSearch();
            }

            // Escape to close
            if (e.key === 'Escape' && this.isOpen) {
                this.closeSearch();
            }
        });

        // Search input listener
        const searchInput = document.getElementById('brdcSearchInput');
        if (searchInput) {
            let debounceTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(debounceTimeout);
                debounceTimeout = setTimeout(() => {
                    this.performSearch(e.target.value);
                }, 300);
            });

            // Arrow key navigation (future enhancement)
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    // Navigate results
                }
            });
        }
    }

    /**
     * Build search index from available data
     */
    async buildSearchIndex() {
        try {
            // Get current player's dashboard data
            const playerId = sessionStorage.getItem('currentPlayerId');
            const playerData = sessionStorage.getItem('currentPlayer');

            if (playerData) {
                const player = JSON.parse(playerData);

                // Index player's leagues
                if (player.roles && player.roles.playing) {
                    this.searchIndex.leagues = player.roles.playing.map(league => ({
                        id: league.id,
                        name: league.name,
                        type: 'league',
                        url: `/pages/league-view.html?id=${league.id}`,
                        meta: `Team: ${league.team_name || 'No team'}`
                    }));
                }

                // Could add more indexes here (players, events, etc.)
            }

            console.log('Search index built:', this.searchIndex);
        } catch (error) {
            console.warn('Could not build search index:', error);
        }
    }

    /**
     * Perform search
     */
    performSearch(query) {
        const resultsContainer = document.getElementById('brdcSearchResults');

        if (!query || query.length < 2) {
            resultsContainer.innerHTML = '<div class="search-empty">Type to search...</div>';
            return;
        }

        const results = [];
        const lowerQuery = query.toLowerCase();

        // Search leagues
        this.searchIndex.leagues.forEach(item => {
            if (item.name.toLowerCase().includes(lowerQuery) ||
                item.meta.toLowerCase().includes(lowerQuery)) {
                results.push({...item, score: this.calculateScore(item, lowerQuery)});
            }
        });

        // Sort by relevance score
        results.sort((a, b) => b.score - a.score);

        // Render results
        if (results.length === 0) {
            resultsContainer.innerHTML = '<div class="search-empty">No results found</div>';
        } else {
            resultsContainer.innerHTML = results.slice(0, 10).map(result => `
                <a href="${result.url}" class="search-result-item">
                    <div class="search-result-icon">${this.getIcon(result.type)}</div>
                    <div class="search-result-content">
                        <div class="search-result-title">${this.highlightMatch(result.name, query)}</div>
                        <div class="search-result-meta">${result.meta}</div>
                    </div>
                </a>
            `).join('');
        }
    }

    /**
     * Calculate relevance score
     */
    calculateScore(item, query) {
        let score = 0;

        const nameLower = item.name.toLowerCase();
        const metaLower = item.meta.toLowerCase();

        // Exact match
        if (nameLower === query) score += 100;
        // Starts with query
        if (nameLower.startsWith(query)) score += 50;
        // Contains query
        if (nameLower.includes(query)) score += 25;
        // Meta contains query
        if (metaLower.includes(query)) score += 10;

        return score;
    }

    /**
     * Get icon for result type
     */
    getIcon(type) {
        const icons = {
            league: '⚡',
            player: '👤',
            event: '🎯',
            team: '🏆'
        };
        return icons[type] || '📄';
    }

    /**
     * Highlight matching text
     */
    highlightMatch(text, query) {
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    /**
     * Open search modal
     */
    openSearch() {
        const modal = document.getElementById('brdcSearchModal');
        const input = document.getElementById('brdcSearchInput');

        if (modal && input) {
            modal.classList.add('active');
            this.isOpen = true;
            setTimeout(() => input.focus(), 100);
        }
    }

    /**
     * Close search modal
     */
    closeSearch() {
        const modal = document.getElementById('brdcSearchModal');
        const input = document.getElementById('brdcSearchInput');

        if (modal) {
            modal.classList.remove('active');
            this.isOpen = false;

            if (input) {
                input.value = '';
                document.getElementById('brdcSearchResults').innerHTML = '';
            }
        }
    }
}

// Auto-initialize
window.BRDCSearch = BRDCSearch;
window.brdcSearch = null;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.brdcSearch = new BRDCSearch();
        window.brdcSearch.init();
    });
} else {
    window.brdcSearch = new BRDCSearch();
    window.brdcSearch.init();
}
