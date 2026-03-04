// ─── Cache so we don't re-fetch players for the same team ───────────────────
const teamPlayerCache = {};

// Qualification zone thresholds
function getQual(pos) {
  if (pos === 1)             return { color: '#4ade80', label: 'Champions' };
  if (pos >= 2 && pos <= 4) return { color: '#60a5fa', label: 'UCL' };
  if (pos === 5)             return { color: '#fb923c', label: 'UEL' };
  if (pos === 6)             return { color: '#a78bfa', label: 'UECL' };
  if (pos >= 18)            return { color: '#f87171', label: 'Relegation' };
  return null;
}

// ─── Build the standings table ───────────────────────────────────────────────
async function loadTable() {
  try {
    const response = await fetch('/api/standings');
    const data = await response.json();

    if (!data.response?.length || !data.response[0]?.league?.standings) {
      console.error('Invalid standings response', data);
      document.getElementById('tableBody').innerHTML =
        '<tr><td colspan="10" style="text-align:center;padding:2rem;color:#f87171">Failed to load standings.</td></tr>';
      return;
    }

    const standings = data.response[0].league.standings[0];
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    standings.forEach((team, index) => {
      const qual    = getQual(team.rank);
      const gd      = team.goalsDiff;
      const gdClass = gd > 0 ? 'gd-pos' : gd < 0 ? 'gd-neg' : 'gd-zero';
      const gdStr   = gd > 0 ? '+' + gd : String(gd);

      const tr = document.createElement('tr');
      tr.style.animationDelay = (index * 0.04) + 's';

      tr.innerHTML = `
        <td class="pos-cell left">
          <div class="pos-bar" style="background:${qual ? qual.color : 'transparent'}"></div>
          ${team.rank}
        </td>
        <td class="left">
          <div class="team-cell">
            <img class="crest" src="${team.team.logo}" alt="${team.team.name}"
                 onerror="this.style.display='none'">
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
    document.getElementById('tableBody').innerHTML =
      '<tr><td colspan="10" style="text-align:center;padding:2rem;color:#f87171">Error loading standings.</td></tr>';
  }
}

// ─── Fetch all paginated players for a team ──────────────────────────────────
async function fetchAllPlayers(teamId) {
  let all = [], page = 1, totalPages = 1;

  while (page <= totalPages) {
    try {
      const res  = await fetch(`/api/players?team=${teamId}&page=${page}`);
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

// ─── Open the modal and populate it ─────────────────────────────────────────
async function openModal(team) {
  document.getElementById('modalTeam').textContent = team.team.name;

  const crestEl = document.getElementById('modalCrest');
  crestEl.innerHTML = team.team.logo
    ? `<img src="${team.team.logo}" alt="${team.team.name}" style="width:100%;height:100%;object-fit:contain">`
    : '⚽';

  document.getElementById('modalLoading').style.display = 'flex';
  document.getElementById('modalBody').style.display    = 'none';
  document.getElementById('overlay').classList.add('open');
  document.body.style.overflow = 'hidden';

  try {
    // Use cache to avoid re-fetching
    if (!teamPlayerCache[team.team.id]) {
      teamPlayerCache[team.team.id] = await fetchAllPlayers(team.team.id);
    }
    const rawPlayers = teamPlayerCache[team.team.id];

    // ── KEY FIX: deduplicate by player ID before aggregating.
    //    The API paginates all players a team has ever registered.
    //    The same player can appear on multiple pages with identical
    //    season stats, which causes goals/assists/minutes to be multiplied.
    //    We keep only the first occurrence of each player ID.
    const seenIds       = new Set();
    const uniquePlayers = rawPlayers.filter(p => {
      if (seenIds.has(p.player.id)) return false;
      seenIds.add(p.player.id);
      return true;
    });

    // Aggregate PL-only stats (league id 39, season 2024).
    // Number() coercion guards against the API returning these as strings.
    const agg = {};
    uniquePlayers.forEach(p => {
      (p.statistics || []).forEach(s => {
        if (Number(s.league?.id)     !== 39)   return; // not PL
        if (Number(s.league?.season) !== 2024) return; // not this season

        if (!agg[p.player.id]) {
          agg[p.player.id] = { name: p.player.name, goals: 0, assists: 0, minutes: 0 };
        }
        agg[p.player.id].goals   += s.goals?.total   != null ? Number(s.goals.total)   : 0;
        agg[p.player.id].assists += s.goals?.assists  != null ? Number(s.goals.assists) : 0;
        agg[p.player.id].minutes += parseInt(s.games?.minutes || 0);
      });
    });

    const players = Object.values(agg).filter(p => p.minutes > 0);

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
      <div class="player-info">
        <div class="player-name">${p.name}</div>
      </div>
      <div>
        <div class="player-stat${isAssist ? ' assist-stat' : ''}">${p[statKey]}</div>
        <div class="stat-label">${statLabel}</div>
      </div>
    `;
    container.appendChild(div);
  });
}

// ─── Close modal ─────────────────────────────────────────────────────────────
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
