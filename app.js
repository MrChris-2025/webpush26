let activeLeague = 'nfl';
let trackedTeams = JSON.parse(localStorage.getItem('tracked_teams')) || [];
let scoreCache = {};

// UI References
const grid = document.getElementById('scoreboardGrid');
const teamInput = document.getElementById('teamSearchInput');
const masterAlert = document.getElementById('masterAlertToggle');

// Load configurations
masterAlert.checked = localStorage.getItem('alerts_enabled') === 'true';

// Initialize League Switches
['nfl', 'mlb', 'nba'].forEach(league => {
    const btn = document.getElementById(`btn-${league}`);
    if (btn) {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.league-btn').forEach(b => b.className = 'league-btn py-2 text-xs font-bold rounded-xl bg-white/5 text-gray-400');
            e.target.className = 'league-btn py-2 text-xs font-bold rounded-xl bg-red-600 text-white';
            activeLeague = league;
            fetchScores();
        });
    }
});

// Update Alerts Config
if (masterAlert) {
    masterAlert.addEventListener('change', async (e) => {
        localStorage.setItem('alerts_enabled', e.target.checked);
        if (e.target.checked && Notification.permission !== 'granted') {
            await Notification.requestPermission();
        }
    });
}

// Manage Targeted Teams Preference Lookups
if (teamInput) {
    teamInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && teamInput.value.trim() !== '') {
            const value = teamInput.value.trim().toLowerCase();
            if (!trackedTeams.includes(value)) {
                trackedTeams.push(value);
                localStorage.setItem('tracked_teams', JSON.stringify(trackedTeams));
                renderTrackedTeams();
                fetchScores();
            }
            teamInput.value = '';
        }
    });
}

function renderTrackedTeams() {
    const list = document.getElementById('trackedTeamsList');
    if (!list) return;
    list.innerHTML = trackedTeams.map(team => `
        <span class="inline-flex items-center gap-1.5 bg-red-600/20 text-red-400 px-2.5 py-1 rounded-lg text-xs font-bold capitalize">
            ${team}
            <i class="fa-solid fa-xmark cursor-pointer hover:text-red-200" onclick="removeTeam('${team}')"></i>
        </span>
    `).join('');
}

window.removeTeam = (teamName) => {
    trackedTeams = trackedTeams.filter(t => t !== teamName);
    localStorage.setItem('tracked_teams', JSON.stringify(trackedTeams));
    renderTrackedTeams();
    fetchScores();
};

// Pull Engine Data from ESPN Scoreboard API
async function fetchScores() {
    try {
        const sport = activeLeague === 'mlb' ? 'baseball' : activeLeague === 'nba' ? 'basketball' : 'football';
        const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sport}/${activeLeague}/scoreboard`);
        const data = await res.json();
        processEvents(data.events || []);
    } catch (err) {
        console.error("Error connecting data pipes:", err);
    }
}

function processEvents(events) {
    if (!grid) return;
    let cardsHtml = '';
    
    events.forEach(event => {
        const competition = event.competitions[0];
        const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
        const awayTeam = competition.competitors.find(c => c.homeAway === 'away');
        const status = event.status.type.detail;
        
        const homeName = homeTeam.team.shortDisplayName.toLowerCase();
        const awayName = awayTeam.team.shortDisplayName.toLowerCase();
        
        // Filter match views to target specific teams if user configuration rules exist
        const isTracked = trackedTeams.length === 0 || trackedTeams.includes(homeName) || trackedTeams.includes(awayName);
        if (!isTracked) return;

        const currentHomeScore = parseInt(homeTeam.score) || 0;
        const currentAwayScore = parseInt(awayTeam.score) || 0;
        const matchId = event.id;

        // Check cache to monitor live status modifications
        if (scoreCache[matchId]) {
            const oldData = scoreCache[matchId];
            if (masterAlert && masterAlert.checked && (oldData.homeScore !== currentHomeScore || oldData.awayScore !== currentAwayScore)) {
                triggerSystemNotification(
                    `Score Shift: ${awayTeam.team.shortDisplayName} @ ${homeTeam.team.shortDisplayName}`,
                    `${awayTeam.team.shortDisplayName} ${currentAwayScore} - ${currentHomeScore} ${homeTeam.team.shortDisplayName} [${status}]`
                );
            }
        }

        scoreCache[matchId] = { homeScore: currentHomeScore, awayScore: currentAwayScore };

        cardsHtml += `
            <div class="match-card p-4 rounded-xl flex flex-col justify-between relative overflow-hidden">
                <div class="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-2">${status}</div>
                <div class="space-y-2">
                    <div class="flex justify-between items-center">
                        <span class="text-sm font-semibold text-white capitalize">${awayTeam.team.displayName}</span>
                        <span class="text-sm font-black text-white">${currentAwayScore}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-sm font-semibold text-white capitalize">${homeTeam.team.displayName}</span>
                        <span class="text-sm font-black text-white">${currentHomeScore}</span>
                    </div>
                </div>
            </div>`;
    });

    grid.innerHTML = cardsHtml || `<div class="col-span-full py-8 text-center text-xs text-gray-500">No active matches found.</div>`;
}

async function triggerSystemNotification(title, body) {
    try {
        if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.ready;
            if (registration.active) {
                registration.active.postMessage({
                    type: 'SHOW_NOTIFICATION',
                    title: title,
                    body: body
                });
                return;
            }
        }
        new Notification(title, { body });
    } catch (err) {
        new Notification(title, { body });
    }
}

// Simulation Testing Button Trigger
const mockBtn = document.getElementById('mockTriggerBtn');
if (mockBtn) {
    mockBtn.addEventListener('click', () => {
        if (Notification.permission !== 'granted') {
            alert("Turn on System Alerts first!");
            return;
        }
        triggerSystemNotification(
            "⚡ Test Game Alert",
            "Score Shift Simulation: Away 24 - 21 Home [Live]"
        );
    });
}

// Service Worker Registration Handler
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker Live:', reg.scope))
            .catch(err => console.error('Worker registration failed:', err));
    });
}

// Kickstart Loop Processing
renderTrackedTeams();
fetchScores();
setInterval(fetchScores, 15000);
