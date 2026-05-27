import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  PointerEvent as ReactPointerEvent,
} from "react";
import { Document, Page, Outline, pdfjs } from "react-pdf";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize,
  Loader2,
  Edit3,
  MousePointer2,
  Highlighter,
  Trash2,
  Undo,
  Menu,
  X,
  List,
} from "lucide-react";
import { getStroke } from "perfect-freehand";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Set up the worker for pdfjs
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

function getSvgPathFromStroke(stroke: number[][]) {
  if (!stroke.length) return "";
  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc; // Ensure missing properties are imported
    },
    ["M", ...stroke[0], "Q"],
  );
  d.push("Z");
  return d.join(" ");
}

type Point = [number, number, number];
type StrokeData = {
  points: Point[];
  color: string;
  isHighlighter: boolean;
};

export function PdfThumbnail({ url }: { url: string }) {
  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden flex items-center justify-center group-hover:scale-105 transition-transform duration-500 pointer-events-none">
      <Document file={url} loading={null} error={null}>
        <Page
          pageNumber={1}
          width={200}
          className="bg-white shadow"
          renderTextLayer={false}
          renderAnnotationLayer={false}
        />
      </Document>
    </div>
  );
}

interface PdfViewerProps {
  url?: string;
  fileData?: Blob | File | null;
}

export default function PdfViewer({ url, fileData }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>();
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const extractDriveId = (link: string | undefined | null) => {
    if (!link) return null;
    const matchD = link.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (matchD) return matchD[1];
    const matchId = link.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (matchId) return matchId[1];
    return null;
  };
  const driveId = extractDriveId(url);

  const [useDriveIframe, setUseDriveIframe] = useState(!!driveId && !fileData);
  const [showOutline, setShowOutline] = useState(false);
  const [pageInput, setPageInput] = useState<string>("1");

  // Drawing state
  const [tool, setTool] = useState<"pan" | "pen" | "highlighter">("pan");
  const [strokesByPage, setStrokesByPage] = useState<
    Record<number, StrokeData[]>
  >({});
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);

  const drawColor =
    tool === "highlighter" ? "rgba(255, 255, 0, 0.4)" : "#dc2626";

  const handlePointerDown = (e: ReactPointerEvent) => {
    if (tool === "pan") return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setCurrentPoints([
      [e.clientX - rect.left, e.clientY - rect.top, e.pressure || 0.5],
    ]);
  };

  const handlePointerMove = (e: ReactPointerEvent) => {
    if (e.buttons !== 1 || tool === "pan" || currentPoints.length === 0) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCurrentPoints((pts) => [
      ...pts,
      [e.clientX - rect.left, e.clientY - rect.top, e.pressure || 0.5],
    ]);
  };

  const handlePointerUp = (e: ReactPointerEvent) => {
    if (tool === "pan" || currentPoints.length === 0) return;
    const isHighlighter = tool === "highlighter";
    const pts = currentPoints;
    setStrokesByPage((prev) => ({
      ...prev,
      [pageNumber]: [
        ...(prev[pageNumber] || []),
        { points: pts, color: drawColor, isHighlighter },
      ],
    }));
    setCurrentPoints([]);
  };

  const undoStroke = () => {
    if (!strokesByPage[pageNumber]?.length) return;
    setStrokesByPage((prev) => ({
      ...prev,
      [pageNumber]: prev[pageNumber].slice(0, -1),
    }));
  };

  const clearStrokes = () => {
    setStrokesByPage((prev) => ({ ...prev, [pageNumber]: [] }));
  };

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setLoading(false);
    setErrorMsg(null);
  }

  function onDocumentLoadError(error: Error) {
    if (driveId && !fileData) {
      setUseDriveIframe(true);
    } else {
      setErrorMsg(
        "Não foi possível carregar o PDF. Links com bloqueio de CORS não podem ser exibidos no Modo Kindle. Por favor, use um link direto para um arquivo .pdf público.",
      );
    }
  }

  useEffect(() => {
    // Reset state when document changes
    setPageNumber(1);
    setLoading(true);
    setErrorMsg(null);
    setStrokesByPage({});
    setUseDriveIframe(!!driveId && !fileData);
  }, [url, fileData, driveId]);

  const [direction, setDirection] = useState(0);

  const nextPage = useCallback(() => {
    setPageNumber((prev) => {
      if (numPages && prev < numPages) {
        setDirection(1);
        setPageInput(String(prev + 1));
        return prev + 1;
      }
      return prev;
    });
  }, [numPages]);

  const prevPage = useCallback(() => {
    setPageNumber((prev) => {
      if (prev > 1) {
        setDirection(-1);
        setPageInput(String(prev - 1));
        return prev - 1;
      }
      return prev;
    });
  }, []);

  const goToPage = (p: number) => {
    if (p >= 1 && numPages && p <= numPages) {
      setDirection(p > pageNumber ? 1 : -1);
      setPageNumber(p);
      setPageInput(String(p));
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName.toLowerCase() === "input") return;
      if (e.key === "ArrowRight") {
        nextPage();
      } else if (e.key === "ArrowLeft") {
        prevPage();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextPage, prevPage]);

  const zoomIn = () => setScale((prev) => Math.min(prev + 0.2, 3));
  const zoomOut = () => setScale((prev) => Math.max(prev - 0.2, 0.5));

  const [optimalHeight, setOptimalHeight] = useState(
    typeof window !== "undefined"
      ? Math.max(400, window.innerHeight - 120)
      : 800,
  );
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!wrapperRef.current) return;

    const updateHeight = () => {
      if (wrapperRef.current) {
        // Leave room for toolbars and padding
        const newHeight = Math.max(400, wrapperRef.current.clientHeight - 80);
        setOptimalHeight((prev) =>
          Math.abs(prev - newHeight) > 10 ? newHeight : prev,
        );
      }
    };

    updateHeight();

    let timeoutId: number;
    const observer = new ResizeObserver(() => {
      clearTimeout(timeoutId);
      timeoutId = window.setTimeout(updateHeight, 300);
    });

    observer.observe(wrapperRef.current);
    return () => {
      observer.disconnect();
      clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="flex flex-col h-full min-h-0 bg-[#1e1e1e] overflow-hidden relative"
    >
      {useDriveIframe ? (
        <div className="flex flex-col w-full h-full relative">
          <div className="p-2 bg-amber-500/20 text-amber-200 text-xs text-center border-b border-amber-500/30 z-10 backdrop-blur-md shrink-0">
            Modo Kindle indisponível para este arquivo do Drive (bloqueado pelo
            Google). Exibindo visualizador nativo.
          </div>
          <iframe
            src={`https://drive.google.com/file/d/${driveId}/preview`}
            className="flex-1 w-full border-none bg-[#e5e5e5]"
            title="PDF Document"
            allow="autoplay"
          />
        </div>
      ) : (
        <>
          {/* Reader Area */}
          <div className="flex-1 overflow-auto w-full h-full relative flex justify-center py-4 px-2 pdf-scrollbar scroll-smooth">
            {loading && !errorMsg && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 z-10 bg-[#1e1e1e]">
                <Loader2
                  size={32}
                  className="animate-spin mb-4 text-white/50"
                />
                <p className="font-medium animate-pulse text-white/60">
                  Carregando livro...
                </p>
              </div>
            )}

            {errorMsg && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center text-slate-400 z-10 bg-[#1e1e1e]">
                <div className="bg-red-500/10 text-red-400 p-6 rounded-2xl max-w-md border border-red-500/20">
                  <p className="font-medium">{errorMsg}</p>
                  <p className="text-sm opacity-80 mt-4 leading-relaxed">
                    Para uma melhor experiência no estilo Kindle, utilize botões
                    de download de PDF direto ou links sem restrição de
                    segurança (Google Drive e outros serviços bloqueiam por
                    padrão).
                  </p>
                </div>
              </div>
            )}

            {!errorMsg && (!url?.startsWith("local:") || fileData) && (
              <div
                className={`transition-opacity duration-300 ${loading ? "opacity-0" : "opacity-100"} shadow-[0_0_40px_rgba(0,0,0,0.5)] h-max origin-top mb-16 mx-auto relative`}
              >
                <Document
                  file={fileData || url}
                  onLoadSuccess={onDocumentLoadSuccess}
                  onLoadError={onDocumentLoadError}
                  loading={null}
                  className="flex items-start justify-center relative w-full h-full"
                >
                  {/* Outline Sidebar */}
                  <AnimatePresence>
                    {showOutline && (
                      <motion.div
                        initial={{ opacity: 0, width: 0, x: -20 }}
                        animate={{ opacity: 1, width: 256, x: 0 }}
                        exit={{ opacity: 0, width: 0, x: -20 }}
                        className="sticky top-0 overflow-hidden shrink-0 bg-[#252525] rounded-xl border border-white/5 shadow-2xl mr-8 flex flex-col"
                        style={{ maxHeight: optimalHeight }}
                      >
                        <div className="w-64 flex-1 overflow-y-auto pdf-scrollbar pt-4 pb-8 px-4 text-white">
                          <div className="flex items-center justify-between mb-6">
                            <h3 className="font-semibold flex items-center gap-2 text-white/90">
                              <List size={18} />
                              Índice
                            </h3>
                            <button
                              onClick={() => setShowOutline(false)}
                              className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
                            >
                              <X size={16} className="text-white/70" />
                            </button>
                          </div>
                          <div className="text-sm prose prose-invert max-w-none">
                            <Outline
                              onItemClick={({ pageNumber }) => {
                                goToPage(Number(pageNumber));
                              }}
                              className="text-white/80 hover:text-white"
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence
                    mode="wait"
                    initial={false}
                    custom={direction}
                  >
                    <motion.div
                      key={pageNumber}
                      custom={direction}
                      variants={{
                        enter: (dir: number) => ({
                          x: dir > 0 ? 20 : -20,
                          opacity: 0,
                        }),
                        center: {
                          zIndex: 1,
                          x: 0,
                          opacity: 1,
                        },
                        exit: (dir: number) => ({
                          zIndex: 0,
                          x: dir < 0 ? 20 : -20,
                          opacity: 0,
                        }),
                      }}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={{
                        opacity: { duration: 0.2 },
                        x: { type: "spring", stiffness: 300, damping: 30 },
                      }}
                      className="relative isolate w-full flex justify-center"
                    >
                      <Page
                        pageNumber={pageNumber}
                        scale={scale} // use built-in scale
                        height={optimalHeight} // Fits nicely vertically
                        renderTextLayer={true}
                        renderAnnotationLayer={true}
                        className="bg-white"
                      />

                      {/* Drawing Layer */}
                      <svg
                        ref={svgRef}
                        className={`absolute inset-0 w-full h-full z-50 ${tool !== "pan" ? "pointer-events-auto touch-none" : "pointer-events-none"}`}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                      >
                        {/* Previous Strokes */}
                        {strokesByPage[pageNumber]?.map((stroke, i) => (
                          <path
                            key={i}
                            d={getSvgPathFromStroke(
                              getStroke(stroke.points, {
                                size: stroke.isHighlighter ? 24 : 4,
                                thinning: 0.5,
                                smoothing: 0.5,
                                streamline: 0.5,
                              }),
                            )}
                            fill={stroke.color}
                            style={{
                              mixBlendMode: stroke.isHighlighter
                                ? "multiply"
                                : "normal",
                            }}
                          />
                        ))}

                        {/* Current Stroke in progress */}
                        {currentPoints.length > 0 && (
                          <path
                            d={getSvgPathFromStroke(
                              getStroke(currentPoints, {
                                size: tool === "highlighter" ? 24 : 4,
                                thinning: 0.5,
                                smoothing: 0.5,
                                streamline: 0.5,
                              }),
                            )}
                            fill={drawColor}
                            style={{
                              mixBlendMode:
                                tool === "highlighter" ? "multiply" : "normal",
                            }}
                          />
                        )}
                      </svg>
                    </motion.div>
                  </AnimatePresence>
                </Document>
              </div>
            )}
          </div>

          {/* Floating Kindle-like Toolbar */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md text-white px-2 py-2 rounded-full flex items-center gap-2 shadow-2xl border border-white/10 z-20 transition-all hover:bg-black/90">
            {/* Outline Button */}
            {!errorMsg && (
              <>
                <button
                  onClick={() => setShowOutline(!showOutline)}
                  className={`p-2 rounded-full transition-colors ${showOutline ? "bg-indigo-500 text-white" : "hover:bg-white/10 text-white/70"}`}
                  title="Índice"
                >
                  <Menu size={18} />
                </button>
                <div className="w-px h-6 bg-white/20 mx-1"></div>
              </>
            )}

            {/* Tools */}
            <div className="flex items-center gap-1 bg-white/5 p-1 rounded-full px-2">
              <button
                onClick={() => setTool("pan")}
                className={`p-2 rounded-full transition-colors ${tool === "pan" ? "bg-indigo-500 text-white" : "hover:bg-white/10 text-white/70"}`}
                title="Mover e Ler"
              >
                <MousePointer2 size={18} />
              </button>
              <button
                onClick={() => setTool("pen")}
                className={`p-2 rounded-full transition-colors ${tool === "pen" ? "bg-indigo-500 text-white" : "hover:bg-white/10 text-white/70"}`}
                title="Caneta"
              >
                <Edit3 size={18} />
              </button>
              <button
                onClick={() => setTool("highlighter")}
                className={`p-2 rounded-full transition-colors ${tool === "highlighter" ? "bg-yellow-500 text-black" : "hover:bg-white/10 text-white/70"}`}
                title="Marca Texto"
              >
                <Highlighter size={18} />
              </button>

              {strokesByPage[pageNumber]?.length > 0 && (
                <>
                  <div className="w-px h-6 bg-white/20 mx-1"></div>
                  <button
                    onClick={undoStroke}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                    title="Desfazer"
                  >
                    <Undo size={18} />
                  </button>
                  <button
                    onClick={clearStrokes}
                    className="p-2 hover:bg-white/10 text-red-400 rounded-full transition-colors"
                    title="Limpar"
                  >
                    <Trash2 size={18} />
                  </button>
                </>
              )}
            </div>

            <div className="w-px h-8 bg-white/20 mx-2"></div>

            {/* Pagination */}
            <div className="flex items-center gap-2">
              <button
                onClick={prevPage}
                disabled={pageNumber <= 1}
                className="p-2 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent rounded-full transition-colors"
              >
                <ChevronLeft size={24} />
              </button>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  onBlur={() => {
                    const parsed = parseInt(pageInput, 10);
                    if (
                      !isNaN(parsed) &&
                      parsed >= 1 &&
                      numPages &&
                      parsed <= numPages
                    ) {
                      goToPage(parsed);
                    } else {
                      setPageInput(String(pageNumber));
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.currentTarget.blur();
                    }
                  }}
                  className="w-12 text-center bg-white/10 border border-white/20 rounded py-1 px-1 text-sm font-black text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
                <span className="text-white/50 font-normal">
                  / {numPages || "?"}
                </span>
              </div>

              <button
                onClick={nextPage}
                disabled={pageNumber >= (numPages || 1)}
                className="p-2 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent rounded-full transition-colors"
              >
                <ChevronRight size={24} />
              </button>
            </div>

            <div className="w-px h-8 bg-white/20 mx-2"></div>

            {/* Zoom */}
            <div className="flex items-center gap-1 pr-2">
              <button
                onClick={zoomOut}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                title="Diminuir"
              >
                <ZoomOut size={18} className="opacity-80" />
              </button>
              <button
                onClick={zoomIn}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                title="Aumentar"
              >
                <ZoomIn size={18} className="opacity-80" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
