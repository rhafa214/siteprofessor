import React, { useEffect, useState } from 'react';
import { Newspaper, FlaskConical, Trophy, Sparkles, ExternalLink, ArrowRight, ChevronLeft, ChevronRight, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface NewsItem {
  id: string;
  title: string;
  link: string;
  thumbnail: string | null;
  source: string;
  publishedDate?: string;
  category: typeof CATEGORIES[0];
}

const CATEGORIES = [
  { id: 'seduc', title: 'SEDUC-SP', icon: <Newspaper size={14} />, color: "text-indigo-600", bg: "bg-indigo-50", feedUrl: 'https://news.google.com/rss/search?q=Secretaria+da+Educa%C3%A7%C3%A3o+do+Estado+de+S%C3%A3o+Paulo+OR+Seduc-SP&hl=pt-BR&gl=BR&ceid=BR:pt-419' },
  { id: 'ciencia', title: 'Ciência & Tec', icon: <FlaskConical size={14} />, color: "text-emerald-600", bg: "bg-emerald-50", feedUrl: 'https://news.google.com/rss/search?q=Tecnologia+na+Educa%C3%A7%C3%A3o+Brasil&hl=pt-BR&gl=BR&ceid=BR:pt-419' },
  { id: 'atualidades', title: 'Atualidades', icon: <Globe size={14} />, color: "text-orange-600", bg: "bg-orange-50", feedUrl: 'https://news.google.com/rss/search?q=Educa%C3%A7%C3%A3o+MEC+Enem+Vestibular&hl=pt-BR&gl=BR&ceid=BR:pt-419' },
  { id: 'esportes', title: 'Esportes', icon: <Trophy size={14} />, color: "text-rose-600", bg: "bg-rose-50", feedUrl: 'https://news.google.com/rss/headlines/section/topic/SPORTS?hl=pt-BR&gl=BR&ceid=BR:pt-419' },
];

function timeAgo(dateString?: string) {
  if (!dateString) return '';
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
  if (!url) return null;
  if (url.includes('news.google.com/api/attachments') || url.includes('-w200-h200')) {
    return url.replace(/=-w\d+-h\d+.*$/, '=-w800-h600-p-df');
  }
  return url;
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
            const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(cat.feedUrl)}`);
            const data = await res.json();
            
            if (data.status === 'ok') {
              return data.items.map((item: any, idx: number) => {
                let imgUrl = item.thumbnail || item.enclosure?.link;
                if (!imgUrl) {
                  const match = item.description?.match(/<img[^>]+src="([^">]+)"/);
                  if (match) imgUrl = match[1];
                }
                return {
                  id: `${cat.id}-${idx}`,
                  title: item.title.split(' - ')[0],
                  link: item.link,
                  thumbnail: imgUrl ? normalizeImageUrl(imgUrl) : null,
                  source: item.title.split(' - ').pop() || 'Notícias',
                  publishedDate: item.pubDate,
                  category: cat
                };
              });
            }
            return [];
          })
        );
        
        if (isMounted) {
          const now = new Date();
          const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000); // 60 days ago
          
          let flattened = results.flat().filter(n => {
            if (!n.title || !n.link) return false;
            const pubDate = new Date(n.publishedDate || 0);
            return pubDate >= twoMonthsAgo;
          });
          
          // Sort by date newest first
          flattened.sort((a, b) => new Date(b.publishedDate || 0).getTime() - new Date(a.publishedDate || 0).getTime());
          
          // Remove duplicates based on title
          const uniqueNews = flattened.filter((v, i, a) => a.findIndex(t => (t.title === v.title)) === i);
          
          setNews(uniqueNews);
          setLoading(false);
        }
      } catch (error) {
        console.error("Failed to fetch news", error);
        if (isMounted) setLoading(false);
      }
    }
    
    fetchAllNews();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (news.length <= 3 || isPaused) return;
    const interval = setInterval(() => {
      setOffset((prev) => (prev + 3) % news.length);
    }, 8000); // changes every 8s
    return () => clearInterval(interval);
  }, [news.length, isPaused]);

  if (loading) {
    return (
      <div className="bg-transparent h-full flex flex-col">
        <div className="flex items-center gap-2 mb-4 shrink-0">
          <Sparkles size={20} className="text-slate-400" />
          <h2 className="font-bold text-slate-800 tracking-tight">Radar Educação</h2>
        </div>
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-slate-100 rounded-3xl animate-pulse h-full min-h-[300px]" />
          <div className="flex flex-col gap-4">
            <div className="flex-1 bg-slate-100 rounded-2xl animate-pulse" />
            <div className="flex-1 bg-slate-100 rounded-2xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (news.length === 0) return null;

  // Extract 3 news items to show currently
  const offsetNews = [];
  for (let i = 0; i < 3; i++) {
    offsetNews.push(news[(offset + i) % news.length]);
  }

  // Prioritize an item with an image for the hero, else fallback to just the first of the three
  const heroLocalIndex = offsetNews.findIndex(n => n?.thumbnail);
  const heroNews = heroLocalIndex !== -1 ? offsetNews[heroLocalIndex] : offsetNews[0];
  const sideNews = offsetNews.filter((_, idx) => idx !== (heroLocalIndex !== -1 ? heroLocalIndex : 0));

  const handleNext = () => setOffset((prev) => (prev + 3) % news.length);
  const handlePrev = () => setOffset((prev) => (prev - 3 + news.length) % news.length);

  return (
    <div 
      className="bg-transparent h-full flex flex-col"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles size={20} className="text-indigo-600" />
          <h2 className="font-bold text-slate-800 tracking-tight text-lg">Radar Educação</h2>
          <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider hidden sm:inline-block">Ao Vivo</span>
        </div>
        
        {news.length > 3 && (
          <div className="flex gap-2 items-center">
            <span className="text-xs font-bold text-slate-400 mr-2">{Math.floor(offset/3) + 1} / {Math.ceil(news.length/3)}</span>
            <button onClick={handlePrev} className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-600 flex items-center justify-center hover:bg-slate-50 transition-colors shadow-sm">
              <ChevronLeft size={16} />
            </button>
            <button onClick={handleNext} className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-600 flex items-center justify-center hover:bg-slate-50 transition-colors shadow-sm">
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 relative lg:min-h-[340px] flex flex-col overflow-hidden">
        {heroNews && (
          <AnimatePresence mode="wait">
            <motion.div 
              key={offset}
              initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
              transition={{ duration: 0.4 }}
              className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4"
            >
              {/* Main Hero Card */}
              <a 
                href={heroNews.link} 
                target="_blank" 
                rel="noopener noreferrer"
                className="lg:col-span-2 relative rounded-3xl overflow-hidden group border border-slate-200/60 shadow-sm flex flex-col min-h-[300px]"
              >
                {heroNews.thumbnail ? (
                  <>
                    <img 
                      src={heroNews.thumbnail!} 
                      alt="Highlight" 
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                  </>
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-700 via-indigo-600 to-purple-800 transition-transform duration-700 group-hover:scale-105" />
                )}

                <div className="relative h-full flex flex-col justify-end p-6 md:p-8 z-10">
                  <div className="flex items-center gap-2 mb-4">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold shadow-sm ${heroNews.category.bg} ${heroNews.category.color}`}>
                      {heroNews.category.icon}
                      {heroNews.category.title}
                    </span>
                    <span className="text-white/80 text-xs font-medium backdrop-blur-md bg-black/20 px-2 py-1 rounded-lg">
                      {timeAgo(heroNews.publishedDate)}
                    </span>
                  </div>
                  <h3 className={`font-bold leading-tight mb-3 transition-colors ${heroNews.thumbnail ? 'text-white group-hover:text-indigo-200' : 'text-white'} text-2xl md:text-3xl lg:text-4xl`}>
                    {heroNews.title}
                  </h3>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-slate-300 font-medium text-sm flex items-center gap-2">
                      {heroNews.source}
                    </p>
                    <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white group-hover:bg-white group-hover:text-indigo-600 transition-colors">
                      <ArrowRight size={18} />
                    </div>
                  </div>
                </div>
              </a>

              {/* Side News */}
              <div className="flex flex-col gap-4">
                {sideNews.map((item) => (
                  <a
                    key={item.id}
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex-1 bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${item.category.bg} ${item.category.color}`}>
                          {item.category.title}
                        </span>
                        <ExternalLink size={14} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
                      </div>
                      <h4 className="font-bold text-slate-800 leading-snug group-hover:text-indigo-600 transition-colors text-base line-clamp-3">
                        {item.title}
                      </h4>
                    </div>
                    
                    <div className="mt-4 flex items-center justify-between text-xs font-medium text-slate-500">
                      <span className="truncate pr-2">{item.source}</span>
                      <span className="shrink-0">{timeAgo(item.publishedDate)}</span>
                    </div>
                  </a>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
