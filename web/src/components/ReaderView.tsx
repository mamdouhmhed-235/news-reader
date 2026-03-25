import { useEffect, useRef } from "react";
import type { Article } from "../lib/newsapi";

interface ReaderViewProps {
  article: Article;
  onClose: () => void;
}

export default function ReaderView({ article, onClose }: ReaderViewProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const publishedDate = article.published_at
    ? new Date(article.published_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div
      className="reader-overlay"
      ref={overlayRef}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label={`Reading: ${article.title}`}
    >
      <div className="reader-content">
        <div className="reader-header">
          <button
            ref={closeButtonRef}
            className="reader-close"
            onClick={onClose}
            aria-label="Close reader view"
          >
            ×
          </button>
        </div>
        {article.image_url && (
          <img
            className="reader-image"
            src={article.image_url}
            alt={article.title}
            loading="lazy"
          />
        )}
        <div className="reader-body">
          <div>
            <span className="reader-source">{article.source}</span>
            {publishedDate && (
              <span className="reader-date">{publishedDate}</span>
            )}
          </div>
          <h1 className="reader-title">{article.title}</h1>
          <p className="reader-snippet">{article.snippet || article.description}</p>
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="reader-link"
          >
            Read Full Article ↗
          </a>
        </div>
      </div>
    </div>
  );
}
