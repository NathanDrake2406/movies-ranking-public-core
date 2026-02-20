export type SourceName =
  | "allocine_press"
  | "allocine_user"
  | "douban"
  | "imdb"
  | "letterboxd"
  | "metacritic"
  | "rotten_tomatoes"
  | "rotten_tomatoes_all"
  | "rotten_tomatoes_audience"
  | "rotten_tomatoes_top";

export type SourceScore = {
  source: SourceName;
  label: string;
  normalized: number | null; // 0-100
  raw?: {
    value: number | null;
    scale: string;
  };
  count?: number | null; // votes/ratings/reviews count
  url?: string;
  error?: string;
  /** When true, the error is transient (network/scrape failure) and should not be cached. Defaults to true when error is set. */
  transient?: boolean;
  fromFallback?: boolean;
  badge?: string;
};

export type WatchProvider = {
  id: number; // TMDB provider_id
  name: string;
  logoPath: string; // TMDB relative path, e.g. "/t2yyOv40H..."
  type: "stream" | "rent" | "buy";
};

export type MovieInfo = {
  imdbId: string;
  title: string;
  year?: string;
  releaseDate?: string; // "YYYY-MM-DD" from TMDB
  poster?: string;
  tmdbId?: number; // Still used for movie resolution, just not for scoring
  overview?: string;
  runtime?: number;
  rating?: string; // Content rating (G, PG, PG-13, R, etc.)
  genres?: string[];
  director?: string;
  directors?: string[]; // Multiple directors (e.g., Coen Brothers)
  directorPhotos?: (string | null)[]; // TMDB profile photos, parallel to directors
  writers?: string[];
  cinematographer?: string;
  composer?: string;
  editor?: string;
  cast?: string[];
  watchProviders?: WatchProvider[];
  /** TMDB-provided JustWatch deep link for the user's region. */
  justWatchUrl?: string;
  /** Streaming provider IDs across ALL regions (for DB filtering, not display). */
  allStreamProviderIds?: number[];
};

export type WikidataIds = {
  rottenTomatoes?: string;
  metacritic?: string;
  letterboxd?: string;
  douban?: string;
  allocineFilm?: string;
  allocineSeries?: string;
};

export type OverallScore = {
  score: number;
  coverage: number; // fraction of sources present (0-1), count-based
  disagreement: number; // std dev of source scores (0-100)
};

export type ImdbTheme = {
  id: string;
  label: string;
  sentiment: "positive" | "negative" | "neutral";
};

export type RTConsensus = {
  critics?: string;
  audience?: string;
};

export type RankBadgeType = "overall" | "genre" | "year";

export type RankBadge = {
  readonly type: RankBadgeType;
  readonly rank: number;
  readonly totalCount: number;
  readonly label: string; // "Overall", "Sci-Fi", "2023"
  readonly href: string; // "/top", "/top?genre=Sci-Fi", "/top?from=2023&to=2023"
};

export type RankContext = {
  readonly overall: RankBadge;
  readonly genre: RankBadge | null; // null if genre has < 10 films
  readonly year: RankBadge | null; // null if year has < 10 films or year is null
};

export type ScorePayload = {
  movie: MovieInfo;
  sources: SourceScore[];
  overall: OverallScore | null;
  missingSources?: string[];
  themes?: ImdbTheme[];
  consensus?: RTConsensus;
  imdbSummary?: string; // AI-generated summary from IMDb user reviews
  rankContext?: RankContext;
};
