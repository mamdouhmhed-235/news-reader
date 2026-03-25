import React, { useState, useEffect, useCallback, useRef } from "react";
import { fetchNews, Article, NewsResponse } from "./lib/newsapi";
import HeadlinesList from "./components/HeadlinesList";

const CATEGORIES = [
  "tech",
  "general",
  "science",
  "sports",
  "business",
  "health",
  "entertainment",
  "politics",
  "food",
  "travel",
];

const FAVORITES_KEY = "news-reader-favorites";

function loadFavorites(): string[] {
  try {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveFavorites(ids: string[]) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
}

function loadFavoriteArticles(): Article[] {
  try {
    return JSON.parse(
      localStorage.getItem(FAVORITES_KEY + "-articles") || "[]"
    );
  } catch {
    return [];
  }
}

function saveFavoriteArticles(articles: Article[]) {
  localStorage.setItem(FAVORITES_KEY + "-articles", JSON.stringify(articles));
}

export default function App() {
  const [category, setCategory] = useState("tech");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [articleIndex, setArticleIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [viewFavorites, setViewFavorites] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>(loadFavorites);
  const [favoriteArticles, setFavoriteArticles] = useState<Article[]>(
    loadFavoriteArticles
  );

  const cacheRef = useRef<Map<number, NewsResponse>>(new Map());

  const loadPage = useCallback(
    async (pg: number, cat: string, query: string) => {
      const cacheKey = pg;
      const cached = cacheRef.current.get(cacheKey);
      if (cached) {
        setArticles(cached.data);
        setTotalPages(Math.ceil(cached.meta.found / cached.meta.limit));
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const params: Record<string, string | number> = { page: pg };
        if (query) {
          params.search = query;
        } else {
          params.categories = cat;
        }

        const data = await fetchNews(params);
        cacheRef.current.set(cacheKey, data);
        setArticles(data.data);
        setTotalPages(Math.ceil(data.meta.found / data.meta.limit));
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Failed to load news";
        setError(msg);
        setArticles([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const prefetchPage = useCallback(
    async (pg: number, cat: string, query: string) => {
      if (cacheRef.current.has(pg)) return;
      try {
        const params: Record<string, string | number> = { page: pg };
        if (query) {
          params.search = query;
        } else {
          params.categories = cat;
        }
        const data = await fetchNews(params);
        cacheRef.current.set(pg, data);
      } catch {
        // Silently ignore prefetch failures
      }
    },
    []
  );

  // Initial load and on category/search change
  useEffect(() => {
    setArticles([]);
    setPage(1);
    setArticleIndex(0);
    cacheRef.current.clear();
    loadPage(1, category, search);
  }, [category, search, loadPage]);

  // Prefetch next page when on 2nd article
  useEffect(() => {
    if (articleIndex === 1 && !viewFavorites) {
      prefetchPage(page + 1, category, search);
    }
  }, [articleIndex, page, category, search, prefetchPage, viewFavorites]);

  // Prefetch previous page when on 1st article and page > 1
  useEffect(() => {
    if (articleIndex === 0 && page > 1 && !viewFavorites) {
      prefetchPage(page - 1, category, search);
    }
  }, [articleIndex, page, category, search, prefetchPage, viewFavorites]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchInput.trim();
    setSearch(trimmed);
    if (trimmed) setCategory("");
    else setCategory("tech");
  };

  const handleCategoryChange = (cat: string) => {
    setViewFavorites(false);
    setCategory(cat);
    setSearch("");
    setSearchInput("");
  };

  const handleToggleFavorite = (article: Article) => {
    setFavoriteIds((prev) => {
      let next: string[];
      if (prev.includes(article.uuid)) {
        next = prev.filter((id) => id !== article.uuid);
        setFavoriteArticles((fa) => {
          const updated = fa.filter((a) => a.uuid !== article.uuid);
          saveFavoriteArticles(updated);
          return updated;
        });
      } else {
        next = [...prev, article.uuid];
        setFavoriteArticles((fa) => {
          const updated = [...fa, article];
          saveFavoriteArticles(updated);
          return updated;
        });
      }
      saveFavorites(next);
      return next;
    });
  };

  const handlePrev = () => {
    if (viewFavorites) {
      setArticleIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (articleIndex > 0) {
      setArticleIndex((i) => i - 1);
    } else if (page > 1) {
      setPage((p) => p - 1);
      setArticleIndex(2);
    }
  };

  const handleNext = () => {
    if (viewFavorites) {
      setArticleIndex((i) =>
        Math.min(favoriteArticles.length - 1, i + 1)
      );
      return;
    }
    if (articleIndex < 2 && articleIndex < articles.length - 1) {
      setArticleIndex((i) => i + 1);
    } else {
      setPage((p) => p + 1);
      setArticleIndex(0);
    }
  };

  const handleFirst = () => {
    if (viewFavorites) {
      setArticleIndex(0);
      return;
    }
    setPage(1);
    setArticleIndex(0);
  };

  const displayArticles = viewFavorites ? favoriteArticles : articles;
  const displayTotalPages = viewFavorites
    ? Math.ceil(favoriteArticles.length / 3) || 1
    : totalPages;
  const displayPage = viewFavorites
    ? Math.floor(articleIndex / 3) + 1
    : page;
  const displayIndex = viewFavorites ? articleIndex % 3 : articleIndex;

  return (
    <div className="app">
      <aside className={`sidebar ${showFilters ? "open" : ""}`}>
        <div className="sidebar-header">
          <h1>News Reader</h1>
        </div>
        <form className="search-form" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="Search news..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search news"
          />
          <button type="submit" aria-label="Search">
            🔍
          </button>
        </form>
        <nav className="categories" aria-label="Categories">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`category-btn ${
                category === cat && !search ? "active" : ""
              }`}
              onClick={() => handleCategoryChange(cat)}
              aria-pressed={category === cat && !search}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button
            className={`favorites-toggle ${viewFavorites ? "active" : ""}`}
            onClick={() => {
              setViewFavorites(!viewFavorites);
              if (!viewFavorites) {
                setArticleIndex(0);
              }
            }}
            aria-pressed={viewFavorites}
          >
            ★ Favorites ({favoriteArticles.length})
          </button>
        </div>
      </aside>
      <main className="content">
        <button
          className="mobile-filter-toggle"
          onClick={() => setShowFilters(!showFilters)}
          aria-expanded={showFilters}
        >
          {showFilters ? "Hide Filters" : "Show Filters"}
        </button>
        {showFilters && (
          <div className="mobile-overlay" onClick={() => setShowFilters(false)} />
        )}
        <HeadlinesList
          articles={displayArticles}
          articleIndex={viewFavorites ? displayIndex : articleIndex}
          page={displayPage}
          totalPages={displayTotalPages}
          loading={loading}
          error={viewFavorites ? null : error}
          favorites={favoriteIds}
          onPrev={handlePrev}
          onNext={handleNext}
          onFirst={handleFirst}
          onToggleFavorite={handleToggleFavorite}
        />
      </main>
    </div>
  );
}
