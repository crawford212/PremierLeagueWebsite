const teamPlayerCache = {};

async function fetchAllPlayers(teamId) {
    let allPlayers = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
        try {
            const res = await fetch(`/api/players?team=${teamId}&page=${page}`);
            const data = await res.json();

            if (!data.response) {
                console.warn(`No response on page ${page} for team ${teamId}`, data);
                break;
            }

            allPlayers.push(...data.response);

            // Ensure totalPages is read correctly
            totalPages = data.paging?.total || 1;

            console.log(`Fetched page ${page}/${totalPages} for team ${teamId}, players so far: ${allPlayers.length}`);
            page++;
        } catch (err) {
            console.error(`Error fetching players for team ${teamId} on page ${page}`, err);
            break;
        }
    }

    return allPlayers;
}

async function loadTable() {
    try {
        const response = await fetch("/api/standings");
        const data = await response.json();

        if (!data.response || !data.response.length || !data.response[0]?.league?.standings) {
            console.error("Invalid API response", data);
            return;
        }

        const standings = data.response[0].league.standings[0];
        const tbody = document.querySelector("#leagueTable tbody");
        tbody.innerHTML = "";

        standings.forEach(team => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${team.rank}</td>
                <td class="team" data-id="${team.team.id}">${team.team.name}</td>
                <td>${team.all.played}</td>
                <td>${team.all.win}</td>
                <td>${team.all.draw}</td>
                <td>${team.all.lose}</td>
                <td>${team.all.goals.for}</td>
                <td>${team.all.goals.against}</td>
                <td>${team.goalsDiff}</td>
                <td>${team.points}</td>
            `;
            tbody.appendChild(row);
        });

        attachClicks();
    } catch (err) {
        console.error("Error loading table:", err);
    }
}

function attachClicks() {
    const tbody = document.querySelector("#leagueTable tbody");

    tbody.addEventListener("click", async (event) => {
        const cell = event.target.closest(".team");
        if (!cell) return;

        const teamId = cell.dataset.id;
        const row = cell.parentElement;

        if (row.nextElementSibling?.classList.contains("mini-table-row")) {
            row.nextElementSibling.remove();
            return;
        }

        const miniRow = await loadTeamStatsMini(teamId);
        if (miniRow) {
            row.parentNode.insertBefore(miniRow, row.nextElementSibling);
        }
    });
}

async function loadTeamStatsMini(teamId) {
    try {
        let rawPlayers;
        if (teamPlayerCache[teamId]) {
            rawPlayers = teamPlayerCache[teamId];
        } else {
            rawPlayers = await fetchAllPlayers(teamId);
            teamPlayerCache[teamId] = rawPlayers;
        }

        if (!rawPlayers.length) {
            console.warn("No players data for team:", teamId);
            return null;
        }

        // Aggregate stats per player
        const aggregatedPlayers = {};

        rawPlayers.forEach(p => {
            const stats = p.statistics || [];
            let totalGoals = 0;
            let totalAssists = 0;
            let totalMinutes = 0;

            stats.forEach(s => {
                if (s.league?.id === 39 && s.league?.season === 2024) {
                    totalGoals += s.goals?.total || 0;
                    totalAssists += s.goals?.assists || 0;
                    totalMinutes += parseInt(s.games?.minutes || 0);
                }
            });

            if (!aggregatedPlayers[p.player.id]) {
                aggregatedPlayers[p.player.id] = {
                    name: p.player.name,
                    goals: totalGoals,
                    assists: totalAssists,
                    minutes: totalMinutes
                };
            } else {
                aggregatedPlayers[p.player.id].goals += totalGoals;
                aggregatedPlayers[p.player.id].assists += totalAssists;
                aggregatedPlayers[p.player.id].minutes += totalMinutes;
            }
        });

        // Only include players who played at least 1 minute
        const players = Object.values(aggregatedPlayers).filter(p => p.minutes > 0);

        // Debug log before sorting
        console.log(`Team ${teamId} players stats:`, players);

        const topScorers = [...players]
            .filter(p => p.goals > 0)
            .sort((a, b) => b.goals - a.goals)
            .slice(0, 5);

        const topAssisters = [...players]
            .filter(p => p.assists > 0)
            .sort((a, b) => b.assists - a.assists)
            .slice(0, 5);

        const miniRow = document.createElement("tr");
        miniRow.classList.add("mini-table-row");

        const miniCell = document.createElement("td");
        miniCell.colSpan = 10;

        miniCell.innerHTML = `
<div style="display:flex; gap:20px;">
    <table class="mini-table">
        <tr><th colspan="2">Top 5 Scorers</th></tr>
        ${topScorers.map(p => `<tr><td>${p.name}</td><td>${p.goals}</td></tr>`).join("")}
    </table>

    <table class="mini-table">
        <tr><th colspan="2">Top 5 Assisters</th></tr>
        ${topAssisters.map(p => `<tr><td>${p.name}</td><td>${p.assists}</td></tr>`).join("")}
    </table>
</div>
`;

        miniRow.appendChild(miniCell);
        return miniRow;

    } catch (err) {
        console.error("Error fetching team stats for team", teamId, err);
        return null;
    }
}

loadTable();
