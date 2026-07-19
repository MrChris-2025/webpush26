let activeLeague = 'nfl';
let trackedTeams = JSON.parse(localStorage.getItem('tracked_teams')) || [];
const VAPID_PUBLIC_KEY = 'BGUzkLiSemAIlhdNCJWDxARVhPDZRfPhZIsyvtoxOQde-1SCPGOGTpP6b9qtyhNS5oIYq2RpDwu538vXCIdZr6o';

// UI References
const grid = document.getElementById('scoreboardGrid');
const teamInput = document.getElementById('teamSearchInput');
const masterAlert = document.getElementById('masterAlertToggle');

masterAlert.checked = localStorage.getItem('alerts_enabled') === 'true';

// Conversion tool required by browser PushManager setups
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    return new Uint8Array([...window.atob(base64)].map(c => c.charCodeAt(0)));
}

async function subscribeToPushAlerts() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();
        
        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });
        }
        
        // Push secure subscription details out to your Netlify server
        await fetch('/.netlify/functions/save-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(subscription)
        });
    } catch (e) {
        console.error("Subscription pipeline blocked:", e);
    }
}

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

masterAlert.addEventListener('change', async (e) => {
    localStorage.setItem('alerts_enabled', e.target.checked);
    if (e.target.checked) {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
            await subscribeToPushAlerts();
        } else {
            e.target.checked = false;
        }
    }
});

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

async function fetchScores() {
    try {
        const sport = activeLeague === 'mlb' ? 'baseball' : activeLeague === 'nba' ? 'basketball' : 'football';
        const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sport}/${activeLeague}/scoreboard`);
        const data = await res.json();
        processEvents(data.events || []);
    } catch (err) {
        console.error("Error connecting interface pipes:", err);
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

        const currentHomeScore = parseInt(homeTeam.score) || 0;
        const currentAwayScore = parseInt(awayTeam.score) || 0;
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

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js');
    });
}

renderTrackedTeams();
fetchScores();
setInterval(fetchScores, 15000);
