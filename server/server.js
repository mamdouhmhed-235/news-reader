require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

// ===== In-memory cache =====
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function getCacheKey(params) {
  const sorted = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .sort(([a], [b]) => a.localeCompare(b));
  return sorted.map(([k, v]) => `${k}=${v}`).join("&");
}

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
  if (cache.size > 200) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
}

// ===== Rate limiter =====
const rateLimits = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = 30;

function isRateLimited(ip) {
  const now = Date.now();
  let entry = rateLimits.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW) {
    entry = { count: 1, windowStart: now };
    rateLimits.set(ip, entry);
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

// Clean up old rate limit entries periodically
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of rateLimits) {
      if (now - entry.windowStart > RATE_LIMIT_WINDOW) {
        rateLimits.delete(ip);
      }
    }
  }, RATE_LIMIT_WINDOW);
}

// ===== Retry with exponential backoff =====
async function fetchWithRetry(url, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 401 || response.status === 403 || response.status === 429) {
        return response;
      }
      if (response.status >= 500 && attempt < retries - 1) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`Upstream ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      return response;
    } catch (err) {
      if (attempt < retries - 1) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`Network error: ${err.message}, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

// ===== Routes =====

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/news/all", async (req, res) => {
  const token = process.env.THENEWSAPI_TOKEN;

  if (!token) {
    console.error("THENEWSAPI_TOKEN not set");
    return res.status(500).json({ error: "Server configuration error" });
  }

  const ip = req.ip || req.connection?.remoteAddress || "unknown";

  if (isRateLimited(ip)) {
    console.log(`Rate limited: ${ip}`);
    return res.status(429).json({
      error: "Too many requests. Please slow down.",
      retryAfter: 60,
    });
  }

  const { page, categories, search } = req.query;

  const cacheParams = { page, categories, search, language: "en", limit: "3" };
  const cacheKey = getCacheKey(cacheParams);
  const cached = getCached(cacheKey);
  if (cached) {
    console.log(`Cache hit: ${cacheKey}`);
    return res.json(cached);
  }

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
      `Proxying: /v1/news/all?page=${page || 1}&categories=${categories || ""}&search=${search || ""}`
    );
    const response = await fetchWithRetry(url);
    const data = await response.json();

    if (!response.ok) {
      console.error(`TheNewsApi error: ${response.status}`);
      return res.status(response.status).json(data);
    }

    setCache(cacheKey, data);
    res.json(data);
  } catch (err) {
    console.error("Proxy error:", err.message);
    res.status(502).json({ error: "Failed to fetch news after retries" });
  }
});

module.exports = app;

// Local dev: start listening (skip in serverless)
if (require.main === module) {
  const PORT = process.env.PORT || 5177;
  app.listen(PORT, () => {
    console.log(`News proxy running on http://localhost:${PORT}`);
  });
}
