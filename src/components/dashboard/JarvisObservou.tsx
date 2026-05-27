import React from "react";
import { Brain, BotMessageSquare, Sparkles } from "lucide-react";

interface JarvisObservouProps {
  currentTurma: string | null;
  logForCurrentTurma: any;
  latestLog: any;
  isClassEndingSoon: boolean;
  setCurrentView?: (view: any) => void;
  setChatInput: (input: string) => void;
  document: Document;
}

export default function JarvisObservou({
  currentTurma,
  logForCurrentTurma,
  latestLog,
  isClassEndingSoon,
  setCurrentView,
  setChatInput,
  document,
}: JarvisObservouProps) {
  return (
    <div className="bg-gradient-to-b from-indigo-50 to-purple-50 border border-indigo-100 rounded-3xl p-6 shadow-sm flex flex-col items-center justify-center text-center relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
        <Brain size={120} />
      </div>

      <div className="bg-indigo-100 text-indigo-600 w-12 h-12 rounded-full flex items-center justify-center shrink-0 shadow-sm border border-indigo-200 relative z-10 mb-3">
        <BotMessageSquare size={24} />
      </div>

      <div className="flex items-center gap-2 mb-4 relative z-10">
        <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
          Jarvis Observou
        </span>
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
        </span>
      </div>

      <div className="text-slate-700 font-medium text-sm space-y-3 relative z-10 flex-1 flex flex-col items-center justify-center">
        {currentTurma ? (
          logForCurrentTurma ? (
            <div className="flex flex-col gap-2 items-center text-center">
              <p>
                Professor, sua próxima aula será no{" "}
                <strong className="text-indigo-700">{currentTurma}</strong>.
              </p>
              <p className="text-slate-600 bg-white/50 p-3 rounded-xl border border-indigo-100/50 w-full">
                Última aula (
                <strong className="text-slate-800">
                  {logForCurrentTurma.data}
                </strong>
                ):{" "}
                <span className="italic text-slate-800">
                  "{logForCurrentTurma.progresso}"
                </span>
              </p>
              {logForCurrentTurma.lembretes && (
                <p className="text-amber-700 font-semibold bg-amber-50 px-3 py-2 rounded-lg mt-1 w-full border border-amber-200">
                  📝 {logForCurrentTurma.lembretes}
                </p>
              )}
              <button
                onClick={() => setCurrentView?.("diario")}
                className="text-indigo-600 hover:text-indigo-800 mt-1 uppercase text-[10px] font-bold tracking-wider hover:underline transition-colors"
              >
                Ir para o Registro de Aulas &rarr;
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 items-center text-center">
              <p>
                Vi que você está no{" "}
                <strong className="text-indigo-700">{currentTurma}</strong>{" "}
                agora, mas não encontrei registros no seu{" "}
                <strong className="text-indigo-700">Registro de Aulas</strong>{" "}
                para essa turma.
              </p>
              <button
                onClick={() => setCurrentView?.("diario")}
                className="text-indigo-600 hover:text-indigo-800 uppercase text-[10px] font-bold tracking-wider hover:underline transition-colors"
              >
                Registrar uma Aula Agora &rarr;
              </button>
            </div>
          )
        ) : latestLog ? (
          <div className="flex flex-col gap-2 text-center text-indigo-900/80">
            <p>
              No momento você não tem uma aula ativa ou está em seu horário de
              estudos. Aproveite para planejar seus próximos passos!
            </p>
            <p>
              Posso sugerir atividades com base no registro com o{" "}
              <strong className="text-indigo-700">{latestLog.turma}</strong>{" "}
              sobre{" "}
              <strong className="text-indigo-700">{latestLog.progresso}</strong>
              .
            </p>
          </div>
        ) : (
          <div className="text-center text-indigo-900/80">
            <p>
              Você não tem uma aula ativa agora. Como ainda não há registros de
              aula, que tal aproveitar para se organizar ou corrigir avaliações?
            </p>
          </div>
        )}

        {isClassEndingSoon && (
          <p className="text-orange-700 bg-orange-100 border border-orange-200 px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center w-full justify-center">
            ⚠️ Aula perto do fim. Não esqueça do registro!
          </p>
        )}
      </div>

      <div className="relative z-10 shrink-0 w-full mt-5">
        <button
          onClick={() => {
            const prompt =
              currentTurma && logForCurrentTurma
                ? `Gere uma revisão rápida sobre o conteúdo: "${logForCurrentTurma.progresso}" que trabalhei com a turma ${currentTurma} na última aula.`
                : latestLog
                  ? `Estou em um momento de estudo/planejamento. Me dê sugestões de atividades, dinâmicas e exercícios baseados no conteúdo "${latestLog.progresso}" que trabalhei recentemente com a turma ${latestLog.turma}.`
                  : "Estou em um momento de estudo/planejamento. Me dê sugestões de como organizar minha semana e preparar minhas próximas aulas de forma criativa.";
            setChatInput(prompt);
            document
              .getElementById("chat-section")
              ?.scrollIntoView({ behavior: "smooth" });
          }}
          className="w-full bg-white text-indigo-600 border border-indigo-200 px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-indigo-50 transition-colors shadow-sm whitespace-nowrap flex items-center justify-center gap-2"
        >
          <Sparkles size={14} />{" "}
          {currentTurma && logForCurrentTurma
            ? "Sugerir Revisão"
            : latestLog
              ? "Sugerir Atividades"
              : "Planejar Aulas"}
        </button>
      </div>
    </div>
  );
}
