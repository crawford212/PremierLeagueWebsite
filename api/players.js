export default async function handler(req, res) {
  try {
    const teamId = req.query.team;
    const league = req.query.league || 39;
    const season = req.query.season || 2024;
    const page   = req.query.page   || 1;

    const response = await fetch(
      `https://v3.football.api-sports.io/players?league=${league}&season=${season}&team=${teamId}&page=${page}`,
      { headers: { "x-apisports-key": process.env.API_KEY } }
    );
    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch players" });
  }
}
