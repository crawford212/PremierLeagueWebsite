export default async function handler(req, res) {
  try {
    const league = req.query.league || 39;
    const season = req.query.season || 2024;

    const response = await fetch(
      `https://v3.football.api-sports.io/standings?league=${league}&season=${season}`,
      { headers: { "x-apisports-key": process.env.API_KEY } }
    );
    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch standings" });
  }
}
