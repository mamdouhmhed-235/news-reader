export interface Article {
  uuid: string;
  title: string;
  description: string;
  keywords: string;
  snippet: string;
  url: string;
  image_url: string | null;
  language: string;
  published_at: string;
  source: string;
  categories: string[];
  locale: string;
}

export interface NewsResponse {
  meta: {
    found: number;
    returned: number;
    limit: number;
    page: number;
  };
  data: Article[];
}

export interface FetchParams {
  page?: number;
  categories?: string;
  search?: string;
}

export async function fetchNews(params: FetchParams): Promise<NewsResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.categories) query.set("categories", params.categories);
  if (params.search) query.set("search", params.search);

  const url = `/api/news/all?${query.toString()}`;
  const res = await fetch(url);

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    const code = res.status;
    if (code === 429) {
      throw new Error("Daily request limit reached. Please try again later.");
    }
    if (code === 401 || code === 403) {
      throw new Error(
        "TheNewsApi authentication failed. Check your API token."
      );
    }
    throw new Error(error?.error || `Request failed with status ${code}`);
  }

  return res.json();
}
