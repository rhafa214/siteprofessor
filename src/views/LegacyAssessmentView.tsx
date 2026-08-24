import React, { useState, useEffect } from "react";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { BookOpen, AlertTriangle } from "lucide-react";

export default function LegacyAssessmentView({
  defaultTab = "bimestral",
  selectedBimestre,
}: {
  defaultTab?: "bimestral" | "simulado" | "participacao";
  selectedBimestre: string;
}) {
  const [assessmentsGrades] = useLocalStorage<Record<string, any>>("assessments_grades", {});
  const [assessmentsMeta] = useLocalStorage<Record<string, any>>("assessments_meta", {});

  const currentKey = `${defaultTab}_${selectedBimestre}`;
  const grades = assessmentsGrades[currentKey] || [];
  const meta = assessmentsMeta[currentKey] || { title: "", date: "", maxScore: 10 };

  return (
    <div className="flex-1 overflow-auto bg-slate-50/50 p-6 flex flex-col gap-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                Registro Legado
              </h1>
              <p className="text-sm font-medium text-slate-500 mt-1">
                Visualização do histórico antigo. As edições estão desabilitadas.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 overflow-hidden flex flex-col">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Título da Avaliação
            </label>
            <input
              type="text"
              readOnly
              value={meta.title}
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-slate-500 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Data de Aplicação
            </label>
            <input
              type="date"
              readOnly
              value={meta.date}
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-slate-500 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Nota Máxima
            </label>
            <input
              type="number"
              readOnly
              value={meta.maxScore}
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-slate-500 cursor-not-allowed"
            />
          </div>
        </div>

        <div className="overflow-x-auto border-t border-slate-100 pt-4">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b-2 border-slate-100">
                <th className="text-left py-4 px-4 font-bold text-slate-600 w-16">Nº</th>
                <th className="text-left py-4 px-4 font-bold text-slate-600">Aluno(a)</th>
                <th className="text-left py-4 px-4 font-bold text-slate-600 w-32">Nota</th>
                <th className="text-left py-4 px-4 font-bold text-slate-600 w-40">Situação</th>
              </tr>
            </thead>
            <tbody>
              {grades.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500">
                    Nenhum registro encontrado no histórico legado para esta turma/bimestre.
                  </td>
                </tr>
              ) : (
                grades.map((g: any, index: number) => {
                  const grade = g.grade;
                  const isNotaBaixa = typeof grade === "number" && grade < 5;
                  
                  return (
                    <tr key={g.id || index} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-medium text-slate-400">
                        {String(index + 1).padStart(2, '0')}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-700">
                        {g.studentName}
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          readOnly
                          value={grade !== "" ? grade : ""}
                          className={`w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-center font-bold cursor-not-allowed ${
                            isNotaBaixa ? "text-rose-600" : "text-slate-700"
                          }`}
                        />
                      </td>
                      <td className="py-3 px-4">
                        {grade === "" ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700">
                            Não Lançado
                          </span>
                        ) : isNotaBaixa ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700">
                            Abaixo da Média
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700">
                            Lançado
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
