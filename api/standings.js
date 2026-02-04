export default async function handler(req, res) {
  try {
    const teamId = req.query.team;
    const response = await fetch(
      `https://v3.football.api-sports.io/players?league=39&season=2024&team=${teamId}`,
      { headers: { "x-apisports-key": process.env.API_KEY } }
    );

    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch players" });
  }
}
