import React, { useState, useEffect, useCallback, useRef } from "react";
import { fetchNews, Article, NewsResponse } from "./lib/newsapi";
import { useDebounce } from "./lib/useDebounce";
import { getStoredTheme, applyTheme, getAvailableThemes, ThemeName } from "./lib/themes";
import HeadlinesList from "./components/HeadlinesList";
import ReaderView from "./components/ReaderView";

const ALL_CATEGORIES = [
  "tech", "general", "science", "sports", "business",
  "health", "entertainment", "politics", "food", "travel",
];

const FAVORITES_KEY = "news-reader-favorites";
const PREFERENCES_KEY = "news-reader-preferences";
const VIEW_MODE_KEY = "news-reader-view-mode";

export type ViewMode = "pager" | "feed";

function loadFavorites(): string[] {
  try { return JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]"); }
  catch { return []; }
}
function saveFavorites(ids: string[]) { localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids)); }
function loadFavoriteArticles(): Article[] {
  try { return JSON.parse(localStorage.getItem(FAVORITES_KEY + "-articles") || "[]"); }
  catch { return []; }
}
function saveFavoriteArticles(articles: Article[]) {
  localStorage.setItem(FAVORITES_KEY + "-articles", JSON.stringify(articles));
}
function loadPreferredCategories(): string[] {
  try { return JSON.parse(localStorage.getItem(PREFERENCES_KEY) || "[]"); }
  catch { return []; }
}
function savePreferredCategories(cats: string[]) { localStorage.setItem(PREFERENCES_KEY, JSON.stringify(cats)); }
function loadViewMode(): ViewMode {
  const stored = localStorage.getItem(VIEW_MODE_KEY);
  return stored === "feed" ? "feed" : "pager";
}

export default function App() {
  const [theme, setTheme] = useState<ThemeName>(getStoredTheme);
  const [viewMode, setViewMode] = useState<ViewMode>(loadViewMode);
  const [category, setCategory] = useState(() => {
    const prefs = loadPreferredCategories();
    return prefs.length > 0 ? prefs[0] : "tech";
  });
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [articleIndex, setArticleIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<number | null>(null);
  const [retryable, setRetryable] = useState(false);
  const [retryCountdown, setRetryCountdown] = useState(0);
  const [allArticles, setAllArticles] = useState<Article[]>([]);
  const [pageArticles, setPageArticles] = useState<Article[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [viewFavorites, setViewFavorites] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>(loadFavorites);
  const [favoriteArticles, setFavoriteArticles] = useState<Article[]>(loadFavoriteArticles);
  const [preferredCategories, setPreferredCategories] = useState<string[]>(loadPreferredCategories);
  const [useMyFeed, setUseMyFeed] = useState(false);
  const [readerArticle, setReaderArticle] = useState<Article | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const cacheRef = useRef<Map<number, NewsResponse>>(new Map());
  const seenUuidsRef = useRef<Set<string>>(new Set());
  const categorySwitchRef = useRef(false);
  const pendingRef = useRef<Set<number>>(new Set());
  const rateLimitedUntilRef = useRef(0);
  const fetchIdRef = useRef(0);

  const debouncedSearch = useDebounce(searchInput, 300);
  const themes = getAvailableThemes();

  const activeCat = useMyFeed && preferredCategories.length > 0
    ? preferredCategories[0]
    : category;

  // Offline detection
  useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // Theme init
  useEffect(() => { applyTheme(theme); }, []);

  // Debounced search — skip during category switches
  useEffect(() => {
    if (categorySwitchRef.current) return;
    const trimmed = debouncedSearch.trim();
    if (trimmed !== search) {
      setSearch(trimmed);
      if (trimmed) { setCategory(""); setUseMyFeed(false); }
      else if (!useMyFeed) setCategory("tech");
    }
  }, [debouncedSearch]);

  // Retry countdown
  useEffect(() => {
    if (retryCountdown <= 0) return;
    const timer = setTimeout(() => setRetryCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [retryCountdown]);

  // Core: fetch a single page from API with deduplication and cooldown
  const fetchSinglePage = useCallback(async (pg: number, cat: string, query: string): Promise<NewsResponse | null> => {
    // Check 429 cooldown
    if (Date.now() < rateLimitedUntilRef.current) {
      return null;
    }

    if (!navigator.onLine) {
      setError("You are offline. Please check your internet connection.");
      setRetryable(true);
      setLoading(false);
      return null;
    }

    const cached = cacheRef.current.get(pg);
    if (cached) return cached;

    // Deduplicate: don't fetch if already in flight
    if (pendingRef.current.has(pg)) return null;

    const fetchId = ++fetchIdRef.current;
    pendingRef.current.add(pg);

    try {
      const params: Record<string, string | number> = { page: pg };
      if (query) params.search = query;
      else params.categories = cat;
      const data = await fetchNews(params);

      // Only apply result if this is still the latest fetch
      if (fetchId !== fetchIdRef.current) return null;

      cacheRef.current.set(pg, data);
      return data;
    } catch (err: unknown) {
      // Only apply error if this is still the latest fetch
      if (fetchId !== fetchIdRef.current) return null;

      const msg = err instanceof Error ? err.message : "Failed to load news";
      const is429 = err instanceof Error && (err.message.includes("429") || err.message.includes("limit"));
      if (is429) {
        setErrorCode(429);
        // Block further requests for 15 seconds after rate limit
        rateLimitedUntilRef.current = Date.now() + 15000;
      } else {
        setErrorCode(null);
      }
      setError(msg);
      setRetryable(true);
      return null;
    } finally {
      pendingRef.current.delete(pg);
    }
  }, []);

  // Pager mode: load a single page, replace articles (only sets error on non-prefetch calls)
  const loadPagerPage = useCallback(async (pg: number, isPrefetch = false) => {
    // Don't clear error state during 429 cooldown
    if (!isPrefetch) {
      if (Date.now() < rateLimitedUntilRef.current) {
        setError("Daily request limit reached. Please wait a moment and try again.");
        setErrorCode(429);
        setRetryable(true);
        setRetryCountdown(Math.ceil((rateLimitedUntilRef.current - Date.now()) / 1000));
        return;
      }
      setLoading(true);
      setError(null);
      setErrorCode(null);
      setRetryable(false);
    }
    const data = await fetchSinglePage(pg, activeCat, search);
    if (data) {
      setAllArticles(data.data);
      setPageArticles(data.data);
      setHasMore(pg * data.meta.limit < data.meta.found);
    }
    if (!isPrefetch) setLoading(false);
  }, [activeCat, search, fetchSinglePage]);

  // Feed mode: load a page and append to allArticles
  const loadFeedPage = useCallback(async (pg: number, isPrefetch = false) => {
    if (!isPrefetch) {
      if (Date.now() < rateLimitedUntilRef.current) {
        setError("Daily request limit reached. Please wait a moment and try again.");
        setErrorCode(429);
        setRetryable(true);
        setRetryCountdown(Math.ceil((rateLimitedUntilRef.current - Date.now()) / 1000));
        return;
      }
      if (pg === 1) setLoading(true);
      setError(null);
      setErrorCode(null);
      setRetryable(false);
    }
    const data = await fetchSinglePage(pg, activeCat, search);
    if (data) {
      const newArticles = data.data.filter(a => !seenUuidsRef.current.has(a.uuid));
      newArticles.forEach(a => seenUuidsRef.current.add(a.uuid));
      if (pg === 1) {
        setAllArticles(newArticles);
        seenUuidsRef.current.clear();
        data.data.forEach(a => seenUuidsRef.current.add(a.uuid));
      } else {
        setAllArticles(prev => [...prev, ...newArticles]);
      }
      setHasMore(pg * data.meta.limit < data.meta.found);
    }
    if (!isPrefetch && pg === 1) setLoading(false);
  }, [activeCat, search, fetchSinglePage]);

  // Initial load and on category/search change
  useEffect(() => {
    setAllArticles([]);
    setPageArticles([]);
    setPage(1);
    setArticleIndex(0);
    setHasMore(true);
    seenUuidsRef.current.clear();
    cacheRef.current.clear();
    pendingRef.current.clear();
    fetchIdRef.current++;
    // Don't clear error if we're rate limited
    if (Date.now() >= rateLimitedUntilRef.current) {
      setError(null);
      setErrorCode(null);
      setRetryable(false);
    }
    if (viewMode === "pager") {
      loadPagerPage(1);
    } else {
      loadFeedPage(1);
    }
  }, [category, search, useMyFeed, viewMode, loadPagerPage, loadFeedPage]);

  // Prefetch for pager mode — only prefetch, don't overwrite error state
  useEffect(() => {
    if (viewMode !== "pager" || viewFavorites) return;
    if (articleIndex === 1 && pageArticles.length >= 2) {
      const next = page + 1;
      if (!cacheRef.current.has(next) && !pendingRef.current.has(next)) {
        fetchSinglePage(next, activeCat, search).catch(() => {});
      }
    }
  }, [articleIndex]);

  useEffect(() => {
    if (viewMode !== "pager" || viewFavorites) return;
    if (articleIndex === 0 && page > 1) {
      const prev = page - 1;
      if (!cacheRef.current.has(prev) && !pendingRef.current.has(prev)) {
        fetchSinglePage(prev, activeCat, search).catch(() => {});
      }
    }
  }, [articleIndex, page]);

  const handleRetry = () => {
    rateLimitedUntilRef.current = 0;
    if (viewMode === "pager") loadPagerPage(page);
    else loadFeedPage(page);
  };

  const handleCategoryChange = (cat: string) => {
    categorySwitchRef.current = true;
    rateLimitedUntilRef.current = 0; // Reset cooldown on explicit user action
    setViewFavorites(false);
    setUseMyFeed(false);
    setSearch("");
    setSearchInput("");
    setCategory(cat);
    setTimeout(() => { categorySwitchRef.current = false; }, 400);
  };

  const handleMyFeed = () => {
    categorySwitchRef.current = true;
    rateLimitedUntilRef.current = 0;
    setViewFavorites(false);
    setUseMyFeed(true);
    setSearch("");
    setSearchInput("");
    setTimeout(() => { categorySwitchRef.current = false; }, 400);
  };

  const handleTogglePin = (cat: string) => {
    setPreferredCategories(prev => {
      const next = prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat];
      savePreferredCategories(next);
      return next;
    });
  };

  const handleToggleFavorite = (article: Article) => {
    setFavoriteIds(prev => {
      let next: string[];
      if (prev.includes(article.uuid)) {
        next = prev.filter(id => id !== article.uuid);
        setFavoriteArticles(fa => { const u = fa.filter(a => a.uuid !== article.uuid); saveFavoriteArticles(u); return u; });
      } else {
        next = [...prev, article.uuid];
        setFavoriteArticles(fa => { const u = [...fa, article]; saveFavoriteArticles(u); return u; });
      }
      saveFavorites(next);
      return next;
    });
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
    setArticleIndex(0);
  };

  // PAGER MODE navigation
  const handlePagerPrev = () => {
    if (articleIndex > 0) setArticleIndex(i => i - 1);
    else if (page > 1) {
      const prevPage = page - 1;
      setPage(prevPage);
      const cached = cacheRef.current.get(prevPage);
      if (cached) {
        setPageArticles(cached.data);
        setArticleIndex(2);
        setAllArticles(cached.data);
      } else {
        loadPagerPage(prevPage).then(() => setArticleIndex(2));
      }
    }
  };

  const handlePagerNext = () => {
    if (articleIndex < pageArticles.length - 1) {
      setArticleIndex(i => i + 1);
    } else {
      const nextPage = page + 1;
      setPage(nextPage);
      setArticleIndex(0);
      const cached = cacheRef.current.get(nextPage);
      if (cached) {
        setPageArticles(cached.data);
        setAllArticles(cached.data);
        setHasMore(nextPage * cached.meta.limit < cached.meta.found);
      } else {
        loadPagerPage(nextPage);
      }
    }
  };

  const handlePagerFirst = () => {
    if (page === 1) { setArticleIndex(0); return; }
    setPage(1);
    setArticleIndex(0);
    const cached = cacheRef.current.get(1);
    if (cached) {
      setPageArticles(cached.data);
      setAllArticles(cached.data);
      setHasMore(cached.meta.limit < cached.meta.found);
    } else {
      loadPagerPage(1);
    }
  };

  // FEED MODE navigation
  const handleFeedPrev = () => {
    if (articleIndex > 0) setArticleIndex(i => i - 1);
  };

  const handleFeedNext = () => {
    if (articleIndex < allArticles.length - 1) {
      setArticleIndex(i => i + 1);
    } else if (hasMore && !loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadFeedPage(nextPage);
    }
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadFeedPage(nextPage);
  };

  // FAVORITES navigation (shared)
  const handleFavPrev = () => setArticleIndex(i => Math.max(0, i - 1));
  const handleFavNext = () => setArticleIndex(i => Math.min(favoriteArticles.length - 1, i + 1));

  // Select handlers based on mode
  const handlePrev = viewFavorites ? handleFavPrev : viewMode === "pager" ? handlePagerPrev : handleFeedPrev;
  const handleNext = viewFavorites ? handleFavNext : viewMode === "pager" ? handlePagerNext : handleFeedNext;
  const handleFirst = viewFavorites
    ? () => setArticleIndex(0)
    : viewMode === "pager"
      ? handlePagerFirst
      : () => setArticleIndex(0);

  const displayArticles = viewFavorites ? favoriteArticles : viewMode === "pager" ? pageArticles : allArticles;

  const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTheme = e.target.value as ThemeName;
    setTheme(newTheme);
    applyTheme(newTheme);
  };

  const handleClearSearch = () => {
    categorySwitchRef.current = true;
    setSearchInput("");
    setSearch("");
    if (!useMyFeed) setCategory("tech");
    setTimeout(() => { categorySwitchRef.current = false; }, 400);
  };

  const sortedCategories = [...ALL_CATEGORIES].sort((a, b) => {
    const aPinned = preferredCategories.includes(a) ? 0 : 1;
    const bPinned = preferredCategories.includes(b) ? 0 : 1;
    return aPinned - bPinned;
  });

  return (
    <div className="app">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <aside className={`sidebar ${showFilters ? "open" : ""}`} role="complementary" aria-label="Filters and navigation">
        <div className="sidebar-header">
          <h1>News Reader</h1>
        </div>
        <div className="search-container">
          <form className="search-form" onSubmit={e => e.preventDefault()} role="search">
            <input
              type="text"
              placeholder="Search news..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              aria-label="Search news"
            />
            {searchInput && (
              <button type="button" className="search-clear" onClick={handleClearSearch} aria-label="Clear search">×</button>
            )}
          </form>
        </div>
        {preferredCategories.length > 0 && (
          <button className={`my-feed-btn ${useMyFeed ? "active" : ""}`} onClick={handleMyFeed} aria-pressed={useMyFeed}>
            My Feed ({preferredCategories.length})
          </button>
        )}
        <nav className="categories" aria-label="Categories">
          {sortedCategories.map(cat => (
            <div className="category-item" key={cat}>
              <button
                className={`category-btn ${category === cat && !search && !useMyFeed ? "active" : ""}`}
                onClick={() => handleCategoryChange(cat)}
                aria-pressed={category === cat && !search && !useMyFeed}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
              <button
                className={`pin-btn ${preferredCategories.includes(cat) ? "pinned" : ""}`}
                onClick={() => handleTogglePin(cat)}
                aria-label={preferredCategories.includes(cat) ? `Unpin ${cat}` : `Pin ${cat}`}
                aria-pressed={preferredCategories.includes(cat)}
              >
                {preferredCategories.includes(cat) ? "★" : "☆"}
              </button>
            </div>
          ))}
        </nav>
        <div className="theme-selector">
          <label htmlFor="theme-select">Theme</label>
          <select id="theme-select" value={theme} onChange={handleThemeChange} aria-label="Select theme">
            {themes.map(t => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>
        <div className="view-mode-toggle">
          <label>View Mode</label>
          <div className="toggle-group" role="radiogroup" aria-label="View mode">
            <button
              className={`toggle-btn ${viewMode === "pager" ? "active" : ""}`}
              onClick={() => handleViewModeChange("pager")}
              role="radio"
              aria-checked={viewMode === "pager"}
            >
              Pager
            </button>
            <button
              className={`toggle-btn ${viewMode === "feed" ? "active" : ""}`}
              onClick={() => handleViewModeChange("feed")}
              role="radio"
              aria-checked={viewMode === "feed"}
            >
              Feed
            </button>
          </div>
        </div>
        <div className="sidebar-footer">
          <button
            className={`favorites-toggle ${viewFavorites ? "active" : ""}`}
            onClick={() => {
              setViewFavorites(!viewFavorites);
              if (!viewFavorites) setArticleIndex(0);
            }}
            aria-pressed={viewFavorites}
          >
            Favorites ({favoriteArticles.length})
          </button>
        </div>
      </aside>
      <main className="content" id="main-content">
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
        {isOffline && <div className="offline-banner" role="alert">You are offline. Some features may not work.</div>}
        {search && !loading && !error && (
          <div className="search-results-count" aria-live="polite">
            {allArticles.length === 0 ? `No results for "${search}"` : `${allArticles.length} results for "${search}"`}
          </div>
        )}
        <div aria-live="polite" aria-atomic="true" className="sr-only" role="status">
          {loading ? "Loading articles..." : error ? `Error: ${error}` : `Article ${articleIndex + 1} of ${displayArticles.length}`}
        </div>
        <HeadlinesList
          articles={displayArticles}
          articleIndex={articleIndex}
          viewMode={viewFavorites ? "pager" : viewMode}
          page={viewFavorites ? 1 : page}
          loading={loading && !viewFavorites}
          error={viewFavorites ? null : error}
          errorCode={errorCode}
          retryable={retryable}
          retryCountdown={retryCountdown}
          favorites={favoriteIds}
          hasMore={hasMore && !viewFavorites}
          onPrev={handlePrev}
          onNext={handleNext}
          onFirst={handleFirst}
          onRetry={handleRetry}
          onLoadMore={handleLoadMore}
          onToggleFavorite={handleToggleFavorite}
          onOpenReader={setReaderArticle}
        />
        {readerArticle && (
          <ReaderView article={readerArticle} onClose={() => setReaderArticle(null)} />
        )}
      </main>
    </div>
  );
}
