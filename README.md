# Premier League Stats Website

A web application that displays the current Premier League table and allows users to click on a team to view its top 5 goal scorers and top 5 assisters for the season.

This project was built for portfolio and interview demonstration purposes.

---

## Features

- Live Premier League table (position, points, goal difference, etc.)
- Clickable team rows
- Inline expandable stats per team
- Top 5 scorers and assisters per team
- Client-side caching to reduce API requests
- Clean, responsive UI
- Built with vanilla HTML, CSS, and JavaScript

---

## Tech Stack

- HTML5
- CSS3
- JavaScript (ES6+)
- API-Football (API-Sports)
- Visual Studio 2022 + Live Server

---

## API Usage

This project uses the **API-Football** service from API-Sports.

Due to API rate limits:
- Player data is cached client-side
- Each team is fetched only once per session
- Excessive refreshes may temporarily block responses

If the table does not load, the daily API request limit may have been exceeded.
Wait for the limit to reset and refresh the page.

---

## Setup Instructions

1. Clone the repository
2. Create a `config.js` file (see below)
3. Add your API key
4. Open `index.html` using Live Server

---

## config.js (NOT committed to GitHub)

Create a file called `config.js` in the root directory:

```js
const API_KEY = "YOUR_API_KEY_HERE";
