import type { Article } from "../lib/newsapi";

interface HeadlinesListProps {
  articles: Article[];
  articleIndex: number;
  page: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
  favorites: string[];
  onPrev: () => void;
  onNext: () => void;
  onFirst: () => void;
  onToggleFavorite: (article: Article) => void;
}

function Pagination({
  articleIndex,
  page,
  totalPages,
  onPrev,
  onNext,
  onFirst,
}: Pick<
  HeadlinesListProps,
  "articleIndex" | "page" | "totalPages" | "onPrev" | "onNext" | "onFirst"
>) {
  const absStart = (page - 1) * 3 + 1;
  const pageNumbers = [absStart, absStart + 1, absStart + 2];
  const isFirstPage = page === 1 && articleIndex === 0;
  const isLastPage = page >= totalPages && articleIndex === 2;

  return (
    <div className="pager" role="navigation" aria-label="Article navigation">
      <button
        className="pager-btn"
        onClick={onFirst}
        disabled={isFirstPage}
        aria-label="Go to first article"
      >
        «
      </button>
      <button
        className="pager-btn"
        onClick={onPrev}
        disabled={isFirstPage}
        aria-label="Previous article"
      >
        ‹
      </button>
      {pageNumbers.map((num) => (
        <span
          key={num}
          className={`pager-dot ${
            num === (page - 1) * 3 + articleIndex + 1 ? "active" : ""
          }`}
        >
          {num}
        </span>
      ))}
      <button
        className="pager-btn"
        onClick={onNext}
        disabled={isLastPage}
        aria-label="Next article"
      >
        ›
      </button>
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
  page,
  totalPages,
  loading,
  error,
  favorites,
  onPrev,
  onNext,
  onFirst,
  onToggleFavorite,
}: HeadlinesListProps) {
  if (loading) {
    return (
      <div className="headlines-container">
        <Skeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="headlines-container">
        <div className="error-card" role="alert">
          <p>{error}</p>
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

  return (
    <div className="headlines-container">
      <article
        className="featured-card"
        role="article"
        aria-label={article.title}
      >
        <div
          className="featured-image"
          style={{
            backgroundImage: `url(${article.image_url || "/placeholder.png"})`,
          }}
        >
          <div className="featured-overlay">
            <span className="featured-source">{article.source}</span>
            <h2 className="featured-title">{article.title}</h2>
            <p className="featured-description">{article.description}</p>
            <div className="featured-actions">
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="cta-button"
              >
                View Full Article
              </a>
              <button
                className={`fav-button ${isFav ? "saved" : ""}`}
                onClick={() => onToggleFavorite(article)}
                aria-label={
                  isFav ? "Remove from favorites" : "Save to favorites"
                }
              >
                {isFav ? "★ Saved" : "☆ Save to Favorites"}
              </button>
            </div>
          </div>
        </div>
      </article>
      <Pagination
        articleIndex={articleIndex}
        page={page}
        totalPages={totalPages}
        onPrev={onPrev}
        onNext={onNext}
        onFirst={onFirst}
      />
    </div>
  );
}
