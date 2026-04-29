import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Newspaper, FlaskConical, Trophy, ChevronRight, ChevronLeft } from 'lucide-react';

interface NewsItem {
  title: string;
  link: string;
  thumbnail: string;
  source: string;
  publishedDate?: string;
}

const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?q=80&w=600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=600&auto=format&fit=crop',
];

const CATEGORIES = [
  { id: 'educacao', title: 'Educação', icon: <Newspaper size={16} className="text-indigo-500" />, headerClass: "text-indigo-800", bg: "bg-indigo-50/50", feedUrl: 'https://g1.globo.com/rss/g1/educacao/' },
  { id: 'ciencia', title: 'Ciência & Tecnologia', icon: <FlaskConical size={16} className="text-emerald-500" />, headerClass: "text-emerald-800", bg: "bg-emerald-50/50", feedUrl: 'https://g1.globo.com/rss/g1/ciencia-e-saude/' },
  { id: 'esportes', title: 'Esportes', icon: <Trophy size={16} className="text-orange-500" />, headerClass: "text-orange-800", bg: "bg-orange-50/50", feedUrl: 'https://jovempan.com.br/esportes/feed' },
];

function timeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  const intervals = [
    { label: 'ano', seconds: 31536000 },
    { label: 'mês', seconds: 2592000 },
    { label: 'dia', seconds: 86400 },
    { label: 'hora', seconds: 3600 },
    { label: 'minuto', seconds: 60 }
  ];

  for (let i = 0; i < intervals.length; i++) {
    const interval = intervals[i];
    const count = Math.floor(diffInSeconds / interval.seconds);
    if (count >= 1) {
      return `há ${count} ${interval.label}${count > 1 ? (interval.label === 'mês' ? 'es' : 's') : ''}`;
    }
  }
  return 'agora';
}

function normalizeImageUrl(url: string) {
  if (!url) return url;
  // Attempt to demand a larger image from google news attachment URLs
  if (url.includes('news.google.com/api/attachments') || url.includes('-w200-h200')) {
    return url.replace(/=-w\d+-h\d+.*$/, '=-w600-h400-p-df');
  }
  return url;
}

function CategorySlider({ category, newsItems, loading }: { category: any, newsItems: NewsItem[], loading: boolean }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (newsItems.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % newsItems.length);
    }, 5000 + Math.random() * 2000); // randomize interval slightly so they don't all slide at once
    return () => clearInterval(interval);
  }, [newsItems.length]);

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault();
    setCurrentIndex((prev) => (prev + 1) % newsItems.length);
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.preventDefault();
    setCurrentIndex((prev) => (prev - 1 + newsItems.length) % newsItems.length);
  };

  return (
    <div className={`flex flex-col h-full rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow relative`}>
      <div className={`flex items-center gap-2 px-4 py-3 border-b border-slate-100 shrink-0 z-10 ${category.bg}`}>
        {category.icon}
        <h3 className={`font-bold text-sm tracking-tight ${category.headerClass}`}>{category.title}</h3>
      </div>
      
      <div className="flex-1 relative bg-slate-50 overflow-hidden">
        {loading ? (
          <div className="absolute inset-0 p-4 space-y-4 animate-pulse">
            <div className="w-full h-32 bg-slate-200 rounded-xl" />
            <div className="space-y-2">
              <div className="w-full h-3 bg-slate-200 rounded" />
              <div className="w-2/3 h-3 bg-slate-200 rounded" />
            </div>
          </div>
        ) : newsItems.length === 0 ? (
          <div className="absolute inset-0 flex flex-col justify-center items-center text-slate-400">
            <p className="text-xs font-medium">Não disponível.</p>
          </div>
        ) : (
          <>
            <AnimatePresence mode="wait">
              <motion.a 
                key={currentIndex}
                href={newsItems[currentIndex].link} 
                target="_blank" 
                rel="noopener noreferrer"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 flex flex-col group"
              >
                <div className="w-full h-[140px] overflow-hidden bg-slate-100 relative shrink-0">
                  <img 
                    src={newsItems[currentIndex].thumbnail} 
                    alt="Thumbnail" 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = FALLBACK_IMAGES[currentIndex % FALLBACK_IMAGES.length];
                    }}
                  />
                  <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[10px] text-white font-bold uppercase tracking-wider shadow-sm">
                    {newsItems[currentIndex].source.substring(0, 20)}
                  </div>
                </div>
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <h4 className="font-bold text-slate-800 leading-snug group-hover:text-indigo-600 transition-colors text-sm line-clamp-3">
                    {newsItems[currentIndex].title}
                  </h4>
                  {newsItems[currentIndex].publishedDate && (
                    <span className="text-[10px] text-slate-400 mt-2 block font-medium">
                      {timeAgo(newsItems[currentIndex].publishedDate)}
                    </span>
                  )}
                </div>
              </motion.a>
            </AnimatePresence>
            
            {newsItems.length > 1 && (
              <div className="absolute bottom-3 right-3 flex gap-1 z-10">
                <button onClick={handlePrev} className="w-6 h-6 rounded-full bg-slate-100/80 hover:bg-white text-slate-600 flex items-center justify-center shadow-sm backdrop-blur-sm transition-colors cursor-pointer">
                  <ChevronLeft size={14} />
                </button>
                <button onClick={handleNext} className="w-6 h-6 rounded-full bg-slate-100/80 hover:bg-white text-slate-600 flex items-center justify-center shadow-sm backdrop-blur-sm transition-colors cursor-pointer">
                  <ChevronRight size={14} />
                </button>
              </div>
            )}

            {newsItems.length > 1 && (
              <div className="absolute top-2 right-2 flex gap-1 z-10 opacity-60">
                {newsItems.map((_, i) => (
                  <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === currentIndex ? 'bg-white shadow' : 'bg-white/40'}`} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function NewsCarousel() {
  const [news, setNews] = useState<Record<string, NewsItem[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    async function fetchCategory(feedUrl: string, id: string) {
      try {
        const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`);
        const data = await res.json();
        
        if (data.status === 'ok') {
          return {
             id, 
             items: data.items.map((item: any, i: number) => {
              let imgUrl = item.thumbnail || item.enclosure?.link;
              if (!imgUrl) {
                const match = item.description?.match(/<img[^>]+src="([^">]+)"/);
                if (match) imgUrl = match[1];
              }
              return {
                title: item.title.split(' - ')[0],
                link: item.link,
                thumbnail: normalizeImageUrl(imgUrl) || FALLBACK_IMAGES[i % FALLBACK_IMAGES.length],
                source: item.title.split(' - ').pop() || 'Notícias',
                publishedDate: item.pubDate
              };
            }).filter((item: any) => item.thumbnail).slice(0, 5) // try to get up to 5 items with images
          };
        }
      } catch (error) {
        console.error(`Failed to fetch news for ${id}`, error);
      }
      return { id, items: [] };
    }

    async function fetchAllNews() {
      const results = await Promise.all(
        CATEGORIES.map(cat => fetchCategory(cat.feedUrl, cat.id))
      );
      
      if (isMounted) {
        const newNews: Record<string, NewsItem[]> = {};
        results.forEach(res => {
          newNews[res.id] = res.items; // Fallback happens in map
        });
        setNews(newNews);
        setLoading(false);
      }
    }
    
    fetchAllNews();
    return () => { isMounted = false; };
  }, []);

  return (
    <div className="bg-transparent h-full flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 mb-4 shrink-0">
        <Newspaper size={20} className="text-slate-600" />
        <h2 className="font-bold text-slate-800 tracking-tight">Painel de Notícias</h2>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 h-full min-h-[260px] max-h-[300px]">
        {CATEGORIES.map(cat => (
          <CategorySlider key={cat.id} category={cat} newsItems={news[cat.id] || []} loading={loading} />
        ))}
      </div>
    </div>
  );
}
