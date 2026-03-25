require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 5177;

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/news/all", async (req, res) => {
  const token = process.env.THENEWSAPI_TOKEN;

  if (!token) {
    console.error("THENEWSAPI_TOKEN not set");
    return res.status(500).json({ error: "Server configuration error" });
  }

  const { page, categories, search } = req.query;

  const params = new URLSearchParams();
  params.set("language", "en");
  params.set("limit", "3");
  params.set("api_token", token);

  if (page) params.set("page", page);
  if (categories) params.set("categories", categories);
  if (search) params.set("search", search);

  const url = `https://api.thenewsapi.com/v1/news/all?${params.toString()}`;

  try {
    console.log(
      `Proxying request: /v1/news/all?page=${page || 1}&categories=${categories || ""}&search=${search || ""}`
    );
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      console.error(`TheNewsApi error: ${response.status}`);
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (err) {
    console.error("Proxy error:", err.message);
    res.status(502).json({ error: "Failed to fetch news" });
  }
});

app.listen(PORT, () => {
  console.log(`News proxy running on http://localhost:${PORT}`);
});
