import React, { useEffect, useState } from "react";
import {
  Newspaper,
  FlaskConical,
  Trophy,
  Sparkles,
  ExternalLink,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Globe,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface NewsItem {
  id: string;
  title: string;
  link: string;
  thumbnail: string | null;
  thumbnailAttempted?: boolean;
  source: string;
  publishedDate?: string;
  category: (typeof CATEGORIES)[0];
}

const CATEGORIES = [
  {
    id: "seduc",
    title: "Radar Educação",
    icon: <Newspaper size={14} />,
    color: "text-indigo-600",
    bg: "bg-indigo-50",
    feedUrl:
      "https://news.google.com/rss/search?q=Secretaria+da+Educa%C3%A7%C3%A3o+do+Estado+de+S%C3%A3o+Paulo+OR+Seduc-SP&hl=pt-BR&gl=BR&ceid=BR:pt-419",
  },
  {
    id: "ciencia",
    title: "Ciência & Tec",
    icon: <FlaskConical size={14} />,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    feedUrl:
      "https://news.google.com/rss/search?q=Tecnologia+na+Educa%C3%A7%C3%A3o+Brasil&hl=pt-BR&gl=BR&ceid=BR:pt-419",
  },
  {
    id: "atualidades",
    title: "Atualidades",
    icon: <Globe size={14} />,
    color: "text-orange-600",
    bg: "bg-orange-50",
    feedUrl:
      "https://news.google.com/rss/search?q=Educa%C3%A7%C3%A3o+MEC+Enem+Vestibular&hl=pt-BR&gl=BR&ceid=BR:pt-419",
  },
  {
    id: "esportes",
    title: "Esportes",
    icon: <Trophy size={14} />,
    color: "text-rose-600",
    bg: "bg-rose-50",
    feedUrl:
      "https://news.google.com/rss/headlines/section/topic/SPORTS?hl=pt-BR&gl=BR&ceid=BR:pt-419",
  },
];

function timeAgo(dateString?: string) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  const intervals = [
    { label: "ano", seconds: 31536000 },
    { label: "mês", seconds: 2592000 },
    { label: "dia", seconds: 86400 },
    { label: "hora", seconds: 3600 },
    { label: "minuto", seconds: 60 },
  ];

  for (let i = 0; i < intervals.length; i++) {
    const interval = intervals[i];
    const count = Math.floor(diffInSeconds / interval.seconds);
    if (count >= 1) {
      return `há ${count} ${interval.label}${count > 1 ? (interval.label === "mês" ? "es" : "s") : ""}`;
    }
  }
  return "agora";
}

export default function NewsCarousel() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function fetchAllNews() {
      try {
        const results = await Promise.all(
          CATEGORIES.map(async (cat) => {
            try {
              const res = await fetch(
                `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(cat.feedUrl)}`,
              );
              if (!res.ok) return [];
              const data = await res.json();

              if (data.status === "ok") {
                return data.items.map((item: any, idx: number) => {
                  return {
                    id: `${cat.id}-${idx}`,
                    title: item.title.split(" - ")[0],
                    link: item.link,
                    thumbnail: null,
                    source: item.title.split(" - ").pop() || "Notícias",
                    publishedDate: item.pubDate,
                    category: cat,
                  };
                });
              }
              return [];
            } catch (err) {
              console.error("Failed to fetch news category", err);
              return [];
            }
          }),
        );

        if (isMounted) {
          const now = new Date();
          const twoMonthsAgo = new Date(
            now.getTime() - 60 * 24 * 60 * 60 * 1000,
          ); // 60 days ago

          let flattened = results.flat().filter((n) => {
            if (!n.title || !n.link) return false;
            const pubDate = new Date(n.publishedDate || 0);
            return pubDate >= twoMonthsAgo;
          });

          // Sort by date newest first
          flattened.sort(
            (a, b) =>
              new Date(b.publishedDate || 0).getTime() -
              new Date(a.publishedDate || 0).getTime(),
          );

          // Remove duplicates based on title
          const uniqueNews = flattened.filter(
            (v, i, a) => a.findIndex((t) => t.title === v.title) === i,
          );

          setNews(uniqueNews);
          setLoading(false);
        }
      } catch (error) {
        console.error("Failed to fetch news", error);
        if (isMounted) setLoading(false);
      }
    }

    fetchAllNews();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (news.length <= 1 || isPaused) return;
    const interval = setInterval(() => {
      setOffset((prev) => (prev + 1) % news.length);
    }, 8000); // changes every 8s
    return () => clearInterval(interval);
  }, [news.length, isPaused]);

  if (loading) {
    return (
      <div className="relative w-full h-full min-h-[200px] md:min-h-[220px] rounded-[36px] bg-slate-900 overflow-hidden animate-pulse">
        <div className="absolute bottom-6 left-6 right-6">
          <div className="h-4 w-24 bg-white/20 rounded-full mb-2"></div>
          <div className="h-6 w-3/4 bg-white/20 rounded-full mb-1"></div>
          <div className="h-6 w-2/4 bg-white/20 rounded-full mb-3"></div>
          <div className="h-3 w-1/3 bg-white/20 rounded-full"></div>
        </div>
      </div>
    );
  }

  if (news.length === 0) {
    return (
      <div className="relative w-full h-full min-h-[200px] md:min-h-[220px] rounded-[36px] bg-slate-900 border border-white/10 flex flex-col items-center justify-center p-6 text-center shadow-lg">
        <Newspaper size={40} className="text-white/20 mb-3" />
        <p className="text-white/60 font-medium text-sm">
          Sem notícias no momento.
        </p>
        <p className="text-white/40 text-xs mt-1">
          (A API de notícias pode estar temporariamente indisponível).
        </p>
      </div>
    );
  }

  const currentNews = news[offset % news.length];
  const Icon = currentNews.category.icon.type;

  return (
    <div
      className="relative w-full h-full min-h-[200px] md:min-h-[220px] rounded-[36px] overflow-hidden group shadow-2xl cursor-pointer bg-slate-900"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onClick={() => window.open(currentNews.link, '_blank')}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={offset}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          {/* Background Image or Gradient */}
          <div className="absolute inset-0 transition-transform duration-[10000ms] group-hover:scale-110 ease-linear">
            {currentNews.thumbnail ? (
              <img
                src={currentNews.thumbnail!}
                alt="News Thumbnail"
                className="w-full h-full object-cover opacity-80"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-indigo-900 via-slate-900 to-black opacity-80" />
            )}
          </div>

          {/* Dark Overlay for Text Readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

          {/* Top Right Icon */}
          <div className="absolute top-6 right-6 text-white/90 z-10 pointer-events-none">
            <Icon size={24} strokeWidth={2.5} />
          </div>

          {/* Content */}
          <div className="absolute inset-x-0 bottom-0 p-6 md:p-8 flex flex-col justify-end z-10 pointer-events-none">
            {/* Category & Badge */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-white/80 font-semibold text-xs md:text-sm tracking-wide uppercase">
                {currentNews.category.title}
              </span>
              <span className="bg-rose-500 text-white text-[10px] md:text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wider shadow-sm">
                NOVO
              </span>
            </div>

            {/* Title */}
            <h2 className="text-white font-bold text-lg md:text-xl leading-snug md:leading-snug mb-2 max-w-[100%] line-clamp-3">
              {currentNews.title}
            </h2>

            {/* Subtitle / Meta */}
            <div className="flex items-center gap-1.5 text-white/70 font-medium text-xs">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 shrink-0">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <p className="truncate">
                {currentNews.source} relatando • {timeAgo(currentNews.publishedDate)}
              </p>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Stack Indicator Dots (right edge) - Outside AnimatePresence to stay static */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        {Array.from({ length: Math.min(5, news.length) }).map((_, i) => {
          // Normalize offset to 0-4 for visual indicator
          const activeIndex = offset % Math.min(5, news.length);
          return (
            <div
              key={i}
              className={`w-1.5 rounded-full transition-all duration-300 ${activeIndex === i ? 'h-3 bg-white' : 'h-1.5 bg-white/40'}`}
            />
          );
        })}
      </div>
    </div>
  );
}

