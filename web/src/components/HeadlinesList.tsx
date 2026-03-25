import type { Article } from "../lib/newsapi";
import type { ViewMode } from "../App";

interface HeadlinesListProps {
  articles: Article[];
  articleIndex: number;
  viewMode: ViewMode;
  page: number;
  loading: boolean;
  error: string | null;
  errorCode: number | null;
  retryable: boolean;
  retryCountdown: number;
  favorites: string[];
  hasMore: boolean;
  onPrev: () => void;
  onNext: () => void;
  onFirst: () => void;
  onRetry: () => void;
  onLoadMore: () => void;
  onToggleFavorite: (article: Article) => void;
  onOpenReader: (article: Article) => void;
}

function PagerNav({
  articleIndex,
  totalLoaded,
  page,
  hasMore,
  onPrev,
  onNext,
  onFirst,
}: {
  articleIndex: number;
  totalLoaded: number;
  page: number;
  hasMore: boolean;
  onPrev: () => void;
  onNext: () => void;
  onFirst: () => void;
}) {
  const absStart = (page - 1) * 3 + 1;
  const dots = [absStart, absStart + 1, absStart + 2];
  const currentAbs = (page - 1) * 3 + articleIndex + 1;
  const isFirstPage = page === 1 && articleIndex === 0;
  const isLast = articleIndex === totalLoaded - 1 && !hasMore;

  return (
    <nav className="pager" role="navigation" aria-label="Article navigation">
      <button className="pager-btn" onClick={onFirst} disabled={isFirstPage} aria-label="First article">«</button>
      <button className="pager-btn" onClick={onPrev} disabled={isFirstPage} aria-label="Previous article">‹</button>
      {dots.map(n => (
        <span key={n} className={`pager-dot ${n === currentAbs ? "active" : ""}`}>{n}</span>
      ))}
      <button className="pager-btn" onClick={onNext} disabled={isLast} aria-label="Next article">›</button>
    </nav>
  );
}

function FeedNav({
  articleIndex,
  totalLoaded,
  hasMore,
  loading,
  onPrev,
  onNext,
  onLoadMore,
}: {
  articleIndex: number;
  totalLoaded: number;
  hasMore: boolean;
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
  onLoadMore: () => void;
}) {
  const isFirst = articleIndex === 0;
  const isLast = articleIndex === totalLoaded - 1;
  const atEnd = isLast && !hasMore;

  return (
    <div className="feed-nav">
      <nav className="feed-pager" role="navigation" aria-label="Article navigation">
        <button className="pager-btn" onClick={onPrev} disabled={isFirst} aria-label="Previous article">‹</button>
        <span className="feed-position">Article {articleIndex + 1} of {totalLoaded}{hasMore ? "+" : ""}</span>
        <button className="pager-btn" onClick={onNext} disabled={atEnd} aria-label="Next article">
          {isLast && hasMore ? "+" : "›"}
        </button>
      </nav>
      {isLast && hasMore && (
        <div className="load-more-container">
          <button className="load-more-btn" onClick={onLoadMore} disabled={loading}>
            {loading ? "Loading..." : "Load More Articles"}
          </button>
        </div>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="featured-card skeleton" aria-busy="true" role="status">
      <div className="skeleton-image" />
      <div className="skeleton-overlay">
        <div className="skeleton-line wide" />
        <div className="skeleton-line medium" />
        <div className="skeleton-line narrow" />
      </div>
    </div>
  );
}

export default function HeadlinesList({
  articles,
  articleIndex,
  viewMode,
  page,
  loading,
  error,
  errorCode,
  retryable,
  retryCountdown,
  favorites,
  hasMore,
  onPrev,
  onNext,
  onFirst,
  onRetry,
  onLoadMore,
  onToggleFavorite,
  onOpenReader,
}: HeadlinesListProps) {
  if (loading) {
    return (
      <div className="headlines-container">
        <Skeleton />
      </div>
    );
  }

  if (error) {
    const isQuota = errorCode === 429;
    return (
      <div className="headlines-container">
        <div className={isQuota ? "quota-card" : "error-card"} role="alert">
          <p>{error}</p>
          {retryable && (
            <button className="retry-button" onClick={onRetry}>
              {retryCountdown > 0 ? `Retry in ${retryCountdown}s` : "Retry"}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="headlines-container">
        <div className="empty-card">
          <p>No articles found. Try a different search or category.</p>
        </div>
      </div>
    );
  }

  const article = articles[articleIndex];
  if (!article) return null;

  const isFav = favorites.includes(article.uuid);
  const imgSrc = article.image_url || "/placeholder.png";
  const publishedDate = article.published_at
    ? new Date(article.published_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : null;

  return (
    <div className="headlines-container">
      <article className="featured-card" role="article" aria-label={article.title}>
        <div className="featured-image-wrapper">
          <img
            className="featured-img"
            src={imgSrc}
            alt={article.title}
            loading="lazy"
            onError={e => {
              const img = e.target as HTMLImageElement;
              if (img.src !== "/placeholder.png") img.src = "/placeholder.png";
            }}
          />
          <div className="featured-overlay">
            <div className="featured-meta">
              <span className="featured-source">{article.source}</span>
              {publishedDate && <span className="featured-date">{publishedDate}</span>}
            </div>
            {article.categories && article.categories.length > 0 && (
              <div className="featured-categories">
                {article.categories.map(cat => (
                  <span key={cat} className="category-badge">
                    {cat}
                  </span>
                ))}
              </div>
            )}
            <h2
              className="featured-title"
              onClick={() => onOpenReader(article)}
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenReader(article); } }}
              aria-label={`Read: ${article.title}`}
            >
              {article.title}
            </h2>
            <p className="featured-description">{article.description}</p>
            <div className="featured-actions">
              <button className="cta-button" onClick={() => onOpenReader(article)} aria-label={`Read: ${article.title}`}>
                Read Article
              </button>
              <a href={article.url} target="_blank" rel="noopener noreferrer" className="cta-button cta-outline">
                Open Source
              </a>
              <button
                className={`fav-button ${isFav ? "saved" : ""}`}
                onClick={() => onToggleFavorite(article)}
                aria-label={isFav ? "Remove from favorites" : "Save to favorites"}
                aria-pressed={isFav}
              >
                {isFav ? "Saved" : "Save to Favorites"}
              </button>
            </div>
          </div>
        </div>
      </article>

      {viewMode === "pager" ? (
        <PagerNav
          articleIndex={articleIndex}
          totalLoaded={articles.length}
          page={page}
          hasMore={hasMore}
          onPrev={onPrev}
          onNext={onNext}
          onFirst={onFirst}
        />
      ) : (
        <FeedNav
          articleIndex={articleIndex}
          totalLoaded={articles.length}
          hasMore={hasMore}
          loading={loading}
          onPrev={onPrev}
          onNext={onNext}
          onLoadMore={onLoadMore}
        />
      )}
    </div>
  );
}
