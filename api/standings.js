export default async function handler(req, res) {
  try {
    const response = await fetch(
      "https://v3.football.api-sports.io/standings?league=39&season=2024",
      {
        headers: { "x-apisports-key": process.env.API_KEY }
      }
    );

    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch standings" });
  }
}
