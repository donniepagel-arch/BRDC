import {
    db,
    collection,
    addDoc,
    doc,
    setDoc,
    updateDoc,
    onSnapshot,
    serverTimestamp
} from '/js/firebase-config.js';

const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

class LiveVideoSession {
    constructor({ leagueId, matchId, root, enableScoreAssist = true, gameType = 'x01' }) {
        this.leagueId = leagueId;
        this.matchId = matchId;
        this.root = root;
        this.enableScoreAssist = enableScoreAssist !== false;
        this.gameType = String(gameType || 'x01').toLowerCase();
        this.sessionId = this.buildSessionCode(`${leagueId}:${matchId}`);
        this.peerConnections = new Map();
        this.unsubscribers = [];
        this.offerFingerprints = new Map();
    }

    buildSessionCode(seed) {
        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
            hash = ((hash << 5) - hash) + seed.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash).toString(36).toUpperCase().padStart(6, '0').slice(0, 6);
    }

    async init() {
        if (!this.root || !this.leagueId || !this.matchId) return;

        this.render();
        await this.createSession();
        this.listenForCamera('board');
        this.listenForCamera('thrower');
        this.listenForAutoscoreCandidates();
    }

    async createSession() {
        await setDoc(doc(db, 'streaming_sessions', this.sessionId), {
            session_id: this.sessionId,
            league_id: this.leagueId,
            match_id: this.matchId,
            status: 'active',
            updated_at: serverTimestamp()
        }, { merge: true });
    }

    render() {
        const base = window.location.origin;
        const boardUrl = `${base}/pages/stream-camera.html?session=${encodeURIComponent(this.sessionId)}&role=board&game=${encodeURIComponent(this.gameType)}`;
        const throwerUrl = `${base}/pages/stream-camera.html?session=${encodeURIComponent(this.sessionId)}&role=thrower&game=${encodeURIComponent(this.gameType)}`;

        this.root.innerHTML = `
            <div class="live-video-header">
                <div>
                    <div class="live-video-kicker">Video + Score Assist</div>
                    <div class="live-video-title">Session <span>${this.sessionId}</span></div>
                </div>
                <button class="live-video-copy" type="button" data-copy="${boardUrl}">Copy board link</button>
            </div>
            <div class="live-video-links">
                <a href="${boardUrl}" target="_blank" rel="noopener">Open board phone</a>
                <a href="${throwerUrl}" target="_blank" rel="noopener">Open thrower cam</a>
            </div>
            <div class="live-video-grid">
                ${this.renderVideoSlot('board', 'Board Camera')}
                ${this.renderVideoSlot('thrower', 'Thrower Camera')}
            </div>
            ${this.enableScoreAssist ? `
                <div class="autoscore-card" id="autoscoreCandidateCard">
                    <div class="autoscore-label">Score assist</div>
                    <div class="autoscore-empty">Waiting for board phone score candidates.</div>
                </div>
            ` : ''}
        `;

        this.root.querySelector('.live-video-copy')?.addEventListener('click', async (event) => {
            const url = event.currentTarget.dataset.copy;
            await navigator.clipboard?.writeText(url).catch(() => {});
            event.currentTarget.textContent = 'Copied';
            setTimeout(() => { event.currentTarget.textContent = 'Copy board link'; }, 1500);
        });
    }

    renderVideoSlot(role, label) {
        return `
            <div class="live-video-slot" data-role="${role}">
                <video id="liveVideo_${role}" autoplay playsinline muted></video>
                <div class="live-video-placeholder" id="liveVideoPlaceholder_${role}">
                    <strong>${label}</strong>
                    <span>Connect with code ${this.sessionId}</span>
                </div>
                <div class="live-video-badge">${label}</div>
            </div>
        `;
    }

    listenForCamera(role) {
        const offerRef = doc(db, 'streaming_sessions', this.sessionId, 'offers', role);
        const unsubscribeOffer = onSnapshot(offerRef, async (snapshot) => {
            if (!snapshot.exists()) return;
            const offer = snapshot.data();
            const fingerprint = `${offer.type}:${offer.sdp}`;
            if (!offer.sdp || this.offerFingerprints.get(role) === fingerprint) return;
            this.offerFingerprints.set(role, fingerprint);
            await this.acceptOffer(role, offer);
        });
        this.unsubscribers.push(unsubscribeOffer);

        const unsubscribeIce = onSnapshot(collection(db, 'streaming_sessions', this.sessionId, 'ice_candidates'), (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type !== 'added') return;
                const data = change.doc.data();
                if (data.type !== 'offer' || data.role !== role || !data.candidate) return;
                const pc = this.peerConnections.get(role);
                if (!pc) return;
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                } catch (error) {
                    console.warn('[LiveVideo] ICE candidate ignored:', error.message);
                }
            });
        });
        this.unsubscribers.push(unsubscribeIce);
    }

    async acceptOffer(role, offer) {
        this.closePeer(role);

        const pc = new RTCPeerConnection(rtcConfig);
        this.peerConnections.set(role, pc);

        pc.ontrack = (event) => {
            const video = document.getElementById(`liveVideo_${role}`);
            const placeholder = document.getElementById(`liveVideoPlaceholder_${role}`);
            if (video && event.streams[0]) {
                video.srcObject = event.streams[0];
                video.muted = role !== 'thrower';
                video.play?.().catch(() => {});
            }
            if (placeholder) placeholder.style.display = 'none';
        };

        pc.onicecandidate = async (event) => {
            if (!event.candidate) return;
            await addDoc(collection(db, 'streaming_sessions', this.sessionId, 'ice_candidates'), {
                candidate: event.candidate.toJSON(),
                role,
                type: 'answer',
                timestamp: serverTimestamp()
            });
        };

        pc.onconnectionstatechange = () => {
            const slot = document.querySelector(`.live-video-slot[data-role="${role}"]`);
            if (slot) slot.dataset.state = pc.connectionState;
        };

        await pc.setRemoteDescription(new RTCSessionDescription({
            type: offer.type,
            sdp: offer.sdp
        }));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await setDoc(doc(db, 'streaming_sessions', this.sessionId, 'answers', role), {
            type: answer.type,
            sdp: answer.sdp,
            timestamp: serverTimestamp()
        });
    }

    listenForAutoscoreCandidates() {
        if (!this.enableScoreAssist) return;
        const unsubscribe = onSnapshot(collection(db, 'streaming_sessions', this.sessionId, 'autoscore_candidates'), (snapshot) => {
            const added = snapshot.docChanges()
                .filter(change => change.type === 'added')
                .map(change => ({ id: change.doc.id, ...change.doc.data() }));
            if (!added.length) return;
            this.renderAutoscoreCandidate(added[added.length - 1]);
        });
        this.unsubscribers.push(unsubscribe);
    }

    renderAutoscoreCandidate(candidate) {
        const card = document.getElementById('autoscoreCandidateCard');
        if (!card) return;
        const isCricket = String(candidate.game || this.gameType || 'x01').toLowerCase() === 'cricket';
        const score = candidate.score ?? '-';
        const darts = candidate.darts ?? 3;
        const source = candidate.source || 'board phone';
        const confidence = candidate.confidence ?? candidate.quality_score ?? candidate.quality ?? null;
        const scoreLabel = isCricket ? this.formatCricketCandidate(darts) : String(score);
        const resolvedDarts = Array.isArray(darts)
            ? darts.filter((dart) => dart?.target || Number(dart?.mult) > 0).length
            : Number(darts) || 0;
        card.innerHTML = `
            <div class="autoscore-label">Score assist</div>
            <div class="autoscore-score">${this.escapeHtml(scoreLabel)}</div>
            <div class="autoscore-meta">${resolvedDarts} dart${resolvedDarts === 1 ? '' : 's'} from ${this.escapeHtml(source)}</div>
            <div class="autoscore-meta">${confidence !== null ? `Confidence ${this.escapeHtml(confidence)}` : 'Confidence unavailable'}</div>
            <div class="autoscore-note">Confirm in the scorer before applying.</div>
            <div class="runtime-actions" style="margin-top: 10px;">
                <button class="runtime-btn ghost" type="button" data-autoscore-action="approve" data-autoscore-id="${candidate.id}">Approve</button>
                <button class="runtime-btn ghost" type="button" data-autoscore-action="reject" data-autoscore-id="${candidate.id}">Reject</button>
            </div>
        `;

        card.querySelectorAll('[data-autoscore-action]').forEach((button) => {
            button.addEventListener('click', async () => {
                const action = button.dataset.autoscoreAction;
                const candidateId = button.dataset.autoscoreId;
                await this.reviewAutoscoreCandidate(candidateId, action);
                button.textContent = action === 'approve' ? 'Approved' : 'Rejected';
            });
        });
    }

    async reviewAutoscoreCandidate(candidateId, action) {
        if (!candidateId) return;
        await updateDoc(doc(db, 'streaming_sessions', this.sessionId, 'autoscore_candidates', candidateId), {
            review_status: action,
            reviewed_at: serverTimestamp()
        }).catch(() => {});

        await addDoc(collection(db, 'streaming_sessions', this.sessionId, 'autoscore_reviews'), {
            candidate_id: candidateId,
            action,
            reviewed_at: serverTimestamp()
        }).catch(() => {});
    }

    closePeer(role) {
        const pc = this.peerConnections.get(role);
        if (pc) pc.close();
        this.peerConnections.delete(role);
    }

    destroy() {
        this.unsubscribers.forEach(unsubscribe => unsubscribe());
        this.unsubscribers = [];
        for (const role of this.peerConnections.keys()) this.closePeer(role);
    }

    escapeHtml(value) {
        const div = document.createElement('div');
        div.textContent = String(value || '');
        return div.innerHTML;
    }

    formatCricketCandidate(darts) {
        if (!Array.isArray(darts) || !darts.length) return '-';
        return darts.map((dart) => {
            if (!dart || !dart.target || Number(dart.mult) <= 0) {
                return 'MISS';
            }
            if (dart.label) return dart.label;
            if (dart.target === 'BULL') {
                return Number(dart.mult) >= 2 ? 'DB' : 'SB';
            }
            const prefix = Number(dart.mult) === 3 ? 'T' : Number(dart.mult) === 2 ? 'D' : 'S';
            return `${prefix}${dart.target}`;
        }).join(' | ');
    }
}

window.initLiveVideoSession = function initLiveVideoSession(options) {
    if (window.brdcLiveVideoSession) {
        window.brdcLiveVideoSession.destroy();
    }
    window.brdcLiveVideoSession = new LiveVideoSession(options);
    window.brdcLiveVideoSession.init().catch(error => {
        console.error('[LiveVideo] Failed to initialize:', error);
    });
    return window.brdcLiveVideoSession;
};
