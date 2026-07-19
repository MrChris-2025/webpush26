import { espnScoresCache, leagueConfigs, fetchEspnScores } from './espn-service.js';

const VAPID_PUBLIC_KEY = 'BCT1QPZnQ8TpPtwPp2XtiuWUyeCPf-yFVMHxH09Bd0RDVypw4CvegNpfnYYCYPbvlGmayIdmAYbG_QcCbSMBeBU';
let currentFilter = 'live';

// Push Notification Registration Helper
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
        await fetch('/.netlify/functions/save-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(subscription)
        });
    } catch (e) { console.error("Subscription pipeline blocked:", e); }
}

function broadcastNativePush(title, body, icon, tag) {
    fetch('/.netlify/functions/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            payload: { title, body, icon, tag, url: window.location.origin },
            subscriptions: [] // Fed server-side via persistent DB lookups
        })
    }).catch(() => {});
}

// Local DOM Toast Handler
function triggerLocalToast(league, title, subtitle, msg, logo) {
    const container = document.getElementById('sports-toast-container');
    const id = 'toast_' + Math.random().toString(36).substr(2, 9);
    const config = leagueConfigs[league] || {};
    
    container.insertAdjacentHTML('beforeend', `
        <div id="${id}" class="toast-avatar glass">
            <div class="toast-icon-wrapper">
                ${logo ? `<img src="${logo}" class="w-6 h-6 object-contain" />` : `<i class="${config.fa || 'fa-solid fa-bell'}"></i>`}
            </div>
            <div class="flex-1 min-w-0">
                <p class="text-xs font-black text-red-500 uppercase tracking-wider mb-0.5">${config.label || 'Update'}</p>
                <p class="text-xs font-bold text-white truncate">${title}</p>
                <p class="text-[11px] text-gray-400 truncate mt-0.5">${msg} [${subtitle}]</p>
            </div>
            <div class="toast-dismiss-btn" onclick="document.getElementById('${id}').remove()">&times;</div>
            <div class="toast-progress-bar"></div>
        </div>
    `);
    setTimeout(() => document.getElementById(id)?.remove(), 10000);
}

// UI State Updates
function buildScoreboardGrid() {
    const grid = document.getElementById('matchesGrid');
    const searchVal = document.getElementById('searchInput').value.toLowerCase();
    let html = "";

    for (let key in espnScoresCache) {
        const game = espnScoresCache[key];
        const [home, away] = key.split('_vs_');

        if (currentFilter === 'live' && !game.isLive) continue;
        if (currentFilter === 'all' && game.isLive) continue;
        if (searchVal && !home.includes(searchVal) && !away.includes(searchVal)) continue;

        html += `
            <div class="match-card rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden">
                <div class="flex items-center justify-between mb-4">
                    <span class="text-[10px] tracking-widest font-black uppercase text-gray-500">${game.clock || 'Scheduled'}</span>
                    ${game.isLive ? '<span class="flex h-2 w-2 relative"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span class="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span></span>' : ''}
                </div>
                <div class="space-y-3">
                    <div class="flex items-center justify-between">
                        <span class="font-bold text-sm capitalize">${away}</span>
                        <span class="text-sm font-black">${game.awayScore}</span>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="font-bold text-sm capitalize">${home}</span>
                        <span class="text-sm font-black">${game.homeScore}</span>
                    </div>
                </div>
            </div>`;
    }
    grid.innerHTML = html || `<div class="col-span-full py-12 text-center text-gray-500 text-sm">No Events Active in View.</div>`;
}

// Application Lifecycle Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Connect View Toggles
    const toggle = document.getElementById('globalPushToggle');
    toggle.checked = localStorage.getItem('global_push_notifications') === 'true';
    
    toggle.addEventListener('change', async (e) => {
        localStorage.setItem('global_push_notifications', e.target.checked);
        if (e.target.checked) {
            const perm = await Notification.requestPermission();
            if (perm === 'granted') await subscribeToPushAlerts();
            else e.target.checked = false;
        }
    });

    document.getElementById('topBtnLive').addEventListener('click', () => { currentFilter = 'live'; buildScoreboardGrid(); });
    document.getElementById('topBtnAll').addEventListener('click', () => { currentFilter = 'all'; buildScoreboardGrid(); });
    document.getElementById('searchInput').addEventListener('input', buildScoreboardGrid);

    // Run Engine
    fetchEspnScores(true, { onGridRefresh: buildScoreboardGrid });
    setInterval(() => {
        fetchEspnScores(false, {
            onGridRefresh: buildScoreboardGrid,
            onScoreUpdate: (league, clock, home, hScore, away, aScore, summary, logo, matchKey) => {
                triggerLocalToast(league, `${away} @ ${home}`, clock, `${summary} (${aScore}-${hScore})`, logo);
                if (localStorage.getItem('global_push_notifications') === 'true') {
                    broadcastNativePush(`${away} @ ${home}`, `[${clock}] ${summary} (${aScore}-${hScore})`, logo, matchKey);
                }
            },
            onMatchFinished: (league, home, away, hScore, aScore, matchKey) => {
                triggerLocalToast(league, `${away} @ ${home}`, 'FINAL', `Game Ended: ${aScore}-${hScore}`, null);
                if (localStorage.getItem('global_push_notifications') === 'true') {
                    broadcastNativePush(`${away} vs ${home}`, `Final Score: ${aScore} - ${hScore}`, null, matchKey);
                }
            }
        });
    }, 15000);
});
