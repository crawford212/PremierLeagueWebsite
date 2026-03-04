// ─── State ────────────────────────────────────────────────────────────────────
const teamPlayerCache = {};      // keyed by teamId
const standingsCache  = {};      // keyed by leagueId

let currentLeagueId = 39;       // default: Premier League
let currentSeason   = 2024;

// Qualification rules per league — position → colour
// UCL spots vary by league; these reflect 2024/25 allocations
const QUAL_RULES = {
  39:  pos => pos === 1 ? '#4ade80' : pos <= 4 ? '#60a5fa' : pos === 5 ? '#fb923c' : pos === 6 ? '#a78bfa' : pos >= 18 ? '#f87171' : null,
  140: pos => pos === 1 ? '#4ade80' : pos <= 4 ? '#60a5fa' : pos === 5 ? '#fb923c' : pos === 6 ? '#a78bfa' : pos >= 18 ? '#f87171' : null,
  135: pos => pos === 1 ? '#4ade80' : pos <= 4 ? '#60a5fa' : pos === 5 ? '#fb923c' : pos === 6 ? '#a78bfa' : pos >= 18 ? '#f87171' : null,
  78:  pos => pos === 1 ? '#4ade80' : pos <= 4 ? '#60a5fa' : pos === 5 ? '#fb923c' : pos === 6 ? '#a78bfa' : pos >= 16 ? '#f87171' : null,
  61:  pos => pos === 1 ? '#4ade80' : pos <= 3 ? '#60a5fa' : pos === 4 ? '#a78bfa' : pos >= 15 ? '#f87171' : null,
};

function getQualColor(leagueId, pos) {
  const fn = QUAL_RULES[leagueId];
  return fn ? fn(pos) : null;
}

// ─── League switcher ──────────────────────────────────────────────────────────
document.querySelectorAll('.league-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const leagueId = Number(btn.dataset.league);
    if (leagueId === currentLeagueId) return;

    // Update active state
    document.querySelectorAll('.league-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Update header
    document.getElementById('leagueTitle').textContent = btn.dataset.name;
    document.getElementById('leagueBadge').textContent = btn.dataset.badge;

    currentLeagueId = leagueId;
    loadTable();
  });
});

// ─── Load standings ───────────────────────────────────────────────────────────
async function loadTable() {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = `
    <tr class="loading-row">
      <td colspan="10">
        <div class="loader-wrap">
          <div class="spinner"></div>
          <span>Loading standings…</span>
        </div>
      </td>
    </tr>`;

  try {
    // Use cache if available
    if (!standingsCache[currentLeagueId]) {
      const res  = await fetch(`/api/standings?league=${currentLeagueId}`);
      const data = await res.json();

      console.log('API response:', JSON.stringify(data));
if (!data.response?.length || !data.response[0]?.league?.standings) {
  throw new Error('Invalid standings response');
}
      standingsCache[currentLeagueId] = data.response[0].league.standings[0];
    }

    const standings = standingsCache[currentLeagueId];
    tbody.innerHTML  = '';

    standings.forEach((team, index) => {
      const qualColor = getQualColor(currentLeagueId, team.rank);
      const gd        = team.goalsDiff;
      const gdClass   = gd > 0 ? 'gd-pos' : gd < 0 ? 'gd-neg' : 'gd-zero';
      const gdStr     = gd > 0 ? '+' + gd : String(gd);

      const tr = document.createElement('tr');
      tr.style.animationDelay = (index * 0.04) + 's';

      tr.innerHTML = `
        <td class="pos-cell left">
          <div class="pos-bar" style="background:${qualColor || 'transparent'}"></div>
          ${team.rank}
        </td>
        <td class="left">
          <div class="team-cell">
            <img class="crest" src="${team.team.logo}" alt="${team.team.name}" onerror="this.style.display='none'">
            <span class="team-name">${team.team.name}</span>
          </div>
        </td>
        <td>${team.all.played}</td>
        <td class="hide-mob">${team.all.win}</td>
        <td class="hide-mob">${team.all.draw}</td>
        <td class="hide-mob">${team.all.lose}</td>
        <td class="hide-mob">${team.all.goals.for}</td>
        <td class="hide-mob">${team.all.goals.against}</td>
        <td class="${gdClass}">${gdStr}</td>
        <td class="pts-cell">${team.points}</td>
      `;

      tr.addEventListener('click', () => openModal(team));
      tbody.appendChild(tr);
    });

  } catch (err) {
    console.error('Error loading table:', err);
    tbody.innerHTML =
      '<tr><td colspan="10" style="text-align:center;padding:2rem;color:#f87171">Error loading standings.</td></tr>';
  }
}

// ─── Fetch all paginated players for a team ───────────────────────────────────
async function fetchAllPlayers(teamId, leagueId) {
  let all = [], page = 1, totalPages = 1;

  while (page <= totalPages) {
    try {
      const res  = await fetch(`/api/players?team=${teamId}&league=${leagueId}&page=${page}`);
      const data = await res.json();
      if (!data.response) break;
      all.push(...data.response);
      totalPages = data.paging?.total || 1;
      page++;
    } catch (err) {
      console.error(`Error fetching players page ${page} for team ${teamId}`, err);
      break;
    }
  }
  return all;
}

// ─── Open modal ───────────────────────────────────────────────────────────────
async function openModal(team) {
  document.getElementById('modalTeam').textContent   = team.team.name;
  document.getElementById('modalSeason').textContent = '2024/25 Season Stats';

  const crestEl = document.getElementById('modalCrest');
  crestEl.innerHTML = team.team.logo
    ? `<img src="${team.team.logo}" alt="${team.team.name}" style="width:100%;height:100%;object-fit:contain">`
    : '⚽';

  document.getElementById('modalLoading').style.display = 'flex';
  document.getElementById('modalBody').style.display    = 'none';
  document.getElementById('overlay').classList.add('open');
  document.body.style.overflow = 'hidden';

  // Cache key includes both team AND league so switching leagues doesn't return stale data
  const cacheKey = `${team.team.id}_${currentLeagueId}`;

  try {
    if (!teamPlayerCache[cacheKey]) {
      teamPlayerCache[cacheKey] = await fetchAllPlayers(team.team.id, currentLeagueId);
    }
    const rawPlayers = teamPlayerCache[cacheKey];

    // Deduplicate by player ID — API can return same player on multiple pages
    const seenIds       = new Set();
    const uniquePlayers = rawPlayers.filter(p => {
      if (seenIds.has(p.player.id)) return false;
      seenIds.add(p.player.id);
      return true;
    });

    // Aggregate stats filtered by league, season AND team
    const agg = {};
    uniquePlayers.forEach(p => {
      (p.statistics || []).forEach(s => {
        if (Number(s.league?.id)     !== currentLeagueId) return;
        if (Number(s.league?.season) !== currentSeason)   return;
        if (Number(s.team?.id)       !== team.team.id)    return;

        if (!agg[p.player.id]) {
          agg[p.player.id] = { name: p.player.name, goals: 0, assists: 0, minutes: 0 };
        }
        agg[p.player.id].goals   += s.goals?.total   != null ? Number(s.goals.total)   : 0;
        agg[p.player.id].assists += s.goals?.assists  != null ? Number(s.goals.assists) : 0;
        agg[p.player.id].minutes += parseInt(s.games?.minutes || 0);
      });
    });

    const players      = Object.values(agg).filter(p => p.minutes > 0);
    const topScorers   = [...players].filter(p => p.goals   > 0).sort((a, b) => b.goals   - a.goals).slice(0, 5);
    const topAssisters = [...players].filter(p => p.assists > 0).sort((a, b) => b.assists - a.assists).slice(0, 5);

    renderPlayers('modalScorers',   topScorers,   'goals',   'goals');
    renderPlayers('modalAssisters', topAssisters, 'assists', 'assists');

    document.getElementById('modalLoading').style.display = 'none';
    document.getElementById('modalBody').style.display    = 'grid';

  } catch (err) {
    console.error('Error loading player stats:', err);
    document.getElementById('modalLoading').innerHTML =
      '<span style="color:#f87171">Failed to load player data.</span>';
  }
}

// ─── Render player rows ───────────────────────────────────────────────────────
function renderPlayers(containerId, players, statKey, statLabel) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  if (!players.length) {
    container.innerHTML = '<p class="no-data">No data available</p>';
    return;
  }

  const rankClass = r => r === 1 ? 'r1' : r === 2 ? 'r2' : r === 3 ? 'r3' : '';
  const isAssist  = statKey === 'assists';

  players.forEach((p, i) => {
    const div = document.createElement('div');
    div.className = 'player-row';
    div.style.animationDelay = (i * 0.07) + 's';
    div.innerHTML = `
      <div class="player-rank ${rankClass(i + 1)}">${i + 1}</div>
      <div class="player-info"><div class="player-name">${p.name}</div></div>
      <div>
        <div class="player-stat${isAssist ? ' assist-stat' : ''}">${p[statKey]}</div>
        <div class="stat-label">${statLabel}</div>
      </div>
    `;
    container.appendChild(div);
  });
}

// ─── Close modal ──────────────────────────────────────────────────────────────
function closeModal() {
  document.getElementById('overlay').classList.remove('open');
  document.body.style.overflow = '';
}

function closeModalOnOverlay(event) {
  if (event.target === document.getElementById('overlay')) closeModal();
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ─── Init ─────────────────────────────────────────────────────────────────────
loadTable();

