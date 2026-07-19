let activeLeague = 'mlb'; 
let trackedTeams = JSON.parse(localStorage.getItem('tracked_teams')) || [];
let oldScores = {};

const grid = document.getElementById('scoreboardGrid');
const teamInput = document.getElementById('teamSearchInput');
const masterAlert = document.getElementById('masterAlertToggle');
const simBtn = document.getElementById('btn-sim'); // Add this button to your HTML for testing

if (masterAlert) {
    masterAlert.checked = localStorage.getItem('alerts_enabled') === 'true';
}

// Master Alert Permission Toggle
if (masterAlert) {
    masterAlert.addEventListener('change', async (e) => {
        localStorage.setItem('alerts_enabled', e.target.checked);
        if (e.target.checked) {
            const perm = await Notification.requestPermission();
            if (perm !== 'granted') {
                e.target.checked = false;
                alert("Please allow notifications in iPad Settings for Safari/PWA.");
            }
        }
    });
}

// SIMULATION TRIGGER: Fakes a score update instantly for testing
if (simBtn) {
    simBtn.addEventListener('click', () => {
        if (localStorage.getItem('alerts_enabled') !== 'true') {
            alert("Turn on the System Alerts toggle first!");
            return;
        }
        
        // Immediate simulated notification banner
        new Notification("⚾ SIMULATION: Score Update", {
            body: "Dodgers 4 - 3 Giants [Top 9th]",
            icon: 'https://a.espncdn.com/favicon.ico'
        });
    });
}

// Add Tracked Teams via Input
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

// Main Fetch Engine (Uses iPad resource loop, completely free)
async function fetchScores() {
    try {
        const sport = activeLeague === 'mlb' ? 'baseball' : activeLeague === 'nba' ? 'basketball' : 'football';
        const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sport}/${activeLeague}/scoreboard`);
        const data = await res.json();
        
        const events = data.events || [];
        processEvents(events);
        checkLocalNotifications(events);
    } catch (err) {
        console.error("Error loading scores:", err);
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
        
        const isTracked = trackedTeams.length === 0 || trackedTeams.includes(homeName) || trackedTeams.includes(awayName);
        if (!isTracked) return;

        const currentHomeScore = homeTeam.score || 0;
        const currentAwayScore = awayTeam.score || 0;
        const targetUrl = `https://www.espn.com/${activeLeague}/game/_/gameId/${event.id}`;

        cardsHtml += `
            <div class="match-card p-4 rounded-xl flex flex-col justify-between relative overflow-hidden">
                <div class="flex justify-between items-center mb-2">
                    <span class="text-[10px] uppercase font-bold text-gray-500 tracking-wider">${status}</span>
                    <a href="${targetUrl}" target="_blank" class="text-[10px] font-bold text-red-400 hover:underline">
                        Details <i class="fa-solid fa-arrow-up-right-from-square text-[8px]"></i>
                    </a>
                </div>
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

// Live Notification Monitor
function checkLocalNotifications(events) {
    if (localStorage.getItem('alerts_enabled') !== 'true') return;

    events.forEach(event => {
        const competition = event.competitions[0];
        const home = competition.competitors.find(c => c.homeAway === 'home');
        const away = competition.competitors.find(c => c.homeAway === 'away');
        
        const homeName = home.team.shortDisplayName.toLowerCase();
        const awayName = away.team.shortDisplayName.toLowerCase();
        
        if (trackedTeams.length > 0 && !trackedTeams.includes(homeName) && !trackedTeams.includes(awayName)) return;

        const matchId = event.id;
        const homeScore = parseInt(home.score) || 0;
        const awayScore = parseInt(away.score) || 0;

        if (oldScores[matchId]) {
            const old = oldScores[matchId];
            if (old.homeScore !== homeScore || old.awayScore !== awayScore) {
                new Notification(`Score Update: ${away.team.shortDisplayName} @ ${home.team.shortDisplayName}`, {
                    body: `${away.team.shortDisplayName} ${awayScore} - ${homeScore} ${home.team.shortDisplayName}`,
                    icon: 'https://a.espncdn.com/favicon.ico'
                });
            }
        }
        oldScores[matchId] = { homeScore, awayScore };
    });
}

// Navigation Tabs
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

renderTrackedTeams();
fetchScores();
setInterval(fetchScores, 20000); 
