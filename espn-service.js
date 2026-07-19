// ESPN GLOBAL STATE & CONFIGURATIONS
export let espnScoresCache = {};
export let lastLoggedPlays = {};

export let notifiedFinishedMatches = new Set(
    JSON.parse(localStorage.getItem('notified_finished_matches') || '[]')
);

export const sportsToFetch = [
    { sport: 'basketball', league: 'nba' },
    { sport: 'basketball', league: 'wnba' },
    { sport: 'football', league: 'nfl' },
    { sport: 'baseball', league: 'mlb' },
    { sport: 'hockey', league: 'nhl' },
    { sport: 'soccer', league: 'eng.1' },
    { sport: 'soccer', league: 'fifa.world' },
    { sport: 'mma', league: 'ufc' }
];

export const leagueConfigs = {
    'eng.1': { iconKey: 'soccer', label: 'Premier League', sportKey: 'soccer', fa: 'fa-solid fa-futbol' },
    'fifa.world': { iconKey: 'soccer', label: 'FIFA World Cup', sportKey: 'soccer', fa: 'fa-solid fa-globe' },
    'nba': { iconKey: 'basketball', label: 'NBA', sportKey: 'basketball', fa: 'fa-solid fa-basketball' },
    'wnba': { iconKey: 'basketball', label: 'WNBA', sportKey: 'basketball', fa: 'fa-solid fa-basketball' },
    'nfl': { iconKey: 'football', label: 'NFL', sportKey: 'football', fa: 'fa-solid fa-football' },
    'mlb': { iconKey: 'baseball', label: 'MLB', sportKey: 'baseball', fa: 'fa-solid fa-baseball-bat-ball' },
    'nhl': { iconKey: 'hockey', label: 'NHL', sportKey: 'hockey', fa: 'fa-solid fa-hockey-puck' },
    'ufc': { iconKey: 'mma', label: 'UFC', sportKey: 'mma', fa: 'fa-solid fa-hand-fist' }
};

export function flushEspnTransientMemory() {
    const finalGamesBackup = {};
    for (let key in espnScoresCache) {
        if (espnScoresCache[key].isFinal) {
            finalGamesBackup[key] = espnScoresCache[key];
        }
    }
    espnScoresCache = finalGamesBackup;
    lastLoggedPlays = {};
}

export function parseBaseballScoringManner(text, runsDelta) {
    if (!text) return runsDelta > 0 ? `+${runsDelta} Run Scored` : "Run Scored";
    const lowerText = text.toLowerCase();
    let manner = "";
    let scorerInfo = "";

    const matchBatter = text.match(/^([A-Za-z.\s\-]+?)\s+(?:homers|hits|singles|doubles|triples|walks|grounds|flies)/i);
    if (matchBatter && matchBatter[1]) {
        scorerInfo = matchBatter[1].trim() + " ";
    }

    if (lowerText.includes("grand slam") || runsDelta === 4) manner = `${scorerInfo}GRAND SLAM`;
    else if (lowerText.includes("home run") || lowerText.includes("homers") || lowerText.includes("homered")) manner = `${scorerInfo}HOME RUN`;
    else if (lowerText.includes("double")) manner = `${scorerInfo}Double`;
    else if (lowerText.includes("triple")) manner = `${scorerInfo}Triple`;
    else if (lowerText.includes("single")) manner = `${scorerInfo}Single`;
    else if (lowerText.includes("walk")) manner = `${scorerInfo}Walk`;
    else if (lowerText.includes("sacrifice fly") || lowerText.includes("sac fly")) manner = `${scorerInfo}Sac Fly`;
    else manner = `${scorerInfo}Scoring Play`;

    return `${runsDelta} Run ${manner}`;
}

export async function fetchEspnScores(isInitialLoad = false, callbacks = {}) {
    const { onScoreUpdate, onMatchFinished, onGridRefresh } = callbacks;

    for (const item of sportsToFetch) {
        try {
            const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${item.sport}/${item.league}/scoreboard`);
            if (!res.ok) continue;
            const data = await res.json();
            
            if (data.events) {
                data.events.forEach(event => {
                    const competition = event.competitions?.[0];
                    if (!competition) return;

                    const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
                    const awayTeam = competition.competitors.find(c => c.homeAway === 'away');
                    const matchKey = `${homeTeam.team.name.toLowerCase()}_vs_${awayTeam.team.name.toLowerCase()}`;
                    
                    const parsedHomeScore = parseInt(homeTeam.score) || 0;
                    const parsedAwayScore = parseInt(awayTeam.score) || 0;
                    const clockInfo = event.status.type.detail || '';
                    const isFinal = event.status.type.state === 'post';

                    let baseballData = null;
                    if (item.league === 'mlb') {
                        const sit = competition.situation || {};
                        baseballData = {
                            balls: sit.balls ?? 0,
                            strikes: sit.strikes ?? 0,
                            outs: sit.outs ?? 0
                        };
                    }

                    if (isFinal && !notifiedFinishedMatches.has(matchKey)) {
                        notifiedFinishedMatches.add(matchKey);
                        localStorage.setItem('notified_finished_matches', JSON.stringify(Array.from(notifiedFinishedMatches)));
                        
                        if (!isInitialLoad && onMatchFinished) {
                            onMatchFinished(item.league, homeTeam.team.name, awayTeam.team.name, parsedHomeScore, parsedAwayScore, matchKey);
                        }
                    }

                    if (espnScoresCache[matchKey]) {
                        const previousScore = espnScoresCache[matchKey];
                        if (!isInitialLoad && previousScore.isLive && (previousScore.homeScore !== parsedHomeScore || previousScore.awayScore !== parsedAwayScore)) {
                            if (onScoreUpdate) {
                                let summary = previousScore.homeScore !== parsedHomeScore ? `${homeTeam.team.name.toUpperCase()} SCORED` : `${awayTeam.team.name.toUpperCase()} SCORED`;
                                if (item.league === 'mlb') {
                                    const delta = Math.abs((parsedHomeScore + parsedAwayScore) - (previousScore.homeScore + previousScore.awayScore)) || 1;
                                    summary = parseBaseballScoringManner(competition.situation?.lastPlay?.text || '', delta);
                                }
                                const logo = previousScore.homeScore !== parsedHomeScore ? homeTeam.team.logo : awayTeam.team.logo;
                                onScoreUpdate(item.league, clockInfo, homeTeam.team.name, parsedHomeScore, awayTeam.team.name, parsedAwayScore, summary, logo, matchKey);
                            }
                        }
                    }

                    espnScoresCache[matchKey] = {
                        homeScore: parsedHomeScore,
                        awayScore: parsedAwayScore,
                        clock: clockInfo,
                        isLive: event.status.type.state === 'in',
                        isFinal: isFinal,
                        baseballDetails: baseballData,
                        leagueSymbol: item.league
                    };
                });
            }
        } catch (e) {
            console.error(e);
        }
    }
    if (onGridRefresh) onGridRefresh();
}
