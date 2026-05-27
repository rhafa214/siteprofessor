import React, { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";
import { Users, FileCheck, BrainCircuit, BarChart2 } from "lucide-react";

interface GradeRecord {
  id: string;
  studentName: string;
  grade: number | "";
}

interface BimestralReportViewProps {
  gradesData: Record<string, GradeRecord[]>;
  selectedBimestre: string;
  turmasList?: string[];
  selectedTurma?: string | null;
}

export default function BimestralReportView({ gradesData, selectedBimestre, turmasList, selectedTurma }: BimestralReportViewProps) {
  const stats = useMemo(() => {
    let allGrades: number[] = [];
    let turmas = selectedTurma ? [selectedTurma] : (turmasList || []);

    const turmasStats: Record<string, { total: number, approved: number, reproved: number, sum: number }> = {};

    turmas.forEach(turma => {
      // Assuming activeTab is bimestral
      const key = `${selectedBimestre}_${turma}_bimestral`;
      const data = gradesData[key] || [];
      
      const validGrades = data.filter(g => typeof g.grade === 'number') as { studentName: string, grade: number }[];
      allGrades.push(...validGrades.map(g => g.grade));
      
      turmasStats[turma] = {
        total: validGrades.length,
        approved: validGrades.filter(g => g.grade >= 5).length,
        reproved: validGrades.filter(g => g.grade < 5).length,
        sum: validGrades.reduce((acc, g) => acc + g.grade, 0)
      };
    });

    const totalStudents = allGrades.length;
    const approved = allGrades.filter(g => g >= 5).length;
    const reproved = allGrades.filter(g => g < 5).length;
    const average = totalStudents > 0 ? (allGrades.reduce((acc, g) => acc + g, 0) / totalStudents).toFixed(1) : "0.0";

    const chartData = selectedTurma ? 
      (gradesData[`${selectedBimestre}_${selectedTurma}_bimestral`] || [])
        .filter(g => typeof g.grade === 'number')
        .map((g: any) => ({ name: g.studentName.split(' ')[0], grade: g.grade, fill: g.grade >= 5 ? '#22c55e' : '#ef4444' }))
      : 
      turmas.map(t => ({
        name: t,
        media: turmasStats[t].total > 0 ? Number((turmasStats[t].sum / turmasStats[t].total).toFixed(1)) : 0,
      }));

    const seriesChartData = useMemo(() => {
        if (selectedTurma) return [];
        // Group by series (e.g. "6º ano", "7º ano")
        const seriesData: Record<string, { total: number, sum: number, approved: number, reproved: number }> = {};
        turmas.forEach(t => {
            const seriesMatch = t.match(/^(\d+)°/);
            if (seriesMatch) {
                const sLabel = `${seriesMatch[1]}º anos`;
                if (!seriesData[sLabel]) {
                    seriesData[sLabel] = { total: 0, sum: 0, approved: 0, reproved: 0 };
                }
                const st = turmasStats[t];
                seriesData[sLabel].total += st.total;
                seriesData[sLabel].sum += st.sum;
                seriesData[sLabel].approved += st.approved;
                seriesData[sLabel].reproved += st.reproved;
            }
        });
        
        return Object.keys(seriesData).map(k => ({
            name: k,
            Aprovados: seriesData[k].approved,
            Reprovados: seriesData[k].reproved,
            Média: seriesData[k].total > 0 ? Number((seriesData[k].sum / seriesData[k].total).toFixed(1)) : 0
        }));
    }, [turmas, turmasStats, selectedTurma]);

    return {
      totalStudents,
      approved,
      reproved,
      average,
      chartData,
      seriesChartData
    };
  }, [gradesData, selectedBimestre, turmasList, selectedTurma]);

  const pieData = [
    { name: 'Aprovados', value: stats.approved, fill: '#10b981' },
    { name: 'Reprovados', value: stats.reproved, fill: '#f43f5e' }
  ];

  if (stats.totalStudents === 0) {
     return (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-white border border-slate-200 rounded-3xl min-h-[400px]">
          <BarChart2 className="w-12 h-12 text-slate-300 mb-4" />
          <h3 className="text-lg font-bold text-slate-700 mb-2">Sem Dados Adicionados</h3>
          <p className="text-sm text-slate-500 max-w-sm">Insira notas na aba de Lançamento para visualizar o relatório.</p>
        </div>
     );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
             <Users size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Total de Alunos</p>
            <p className="text-2xl font-bold text-slate-800">{stats.totalStudents}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
             <FileCheck size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Aprovados</p>
            <p className="text-2xl font-bold text-slate-800">{stats.approved}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center shrink-0">
             <FileCheck size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Reprovados</p>
            <p className="text-2xl font-bold text-slate-800">{stats.reproved}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
             <BrainCircuit size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Média Geral</p>
            <p className="text-2xl font-bold text-slate-800">{stats.average}</p>
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
           <h3 className="text-lg font-bold text-slate-800 mb-6">
              {selectedTurma ? "Notas dos Alunos" : "Média por Turma"}
           </h3>
           <div className="h-72 w-full">
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.chartData as any} margin={{ top: 5, right: 0, left: -20, bottom: 5 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip cursor={{ fill: '#f1f5f9' }} />
                  <Bar dataKey={selectedTurma ? "grade" : "media"} radius={[4, 4, 0, 0]}>
                    {selectedTurma && stats.chartData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                    {!selectedTurma && stats.chartData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill="#6366f1" />
                    ))}
                  </Bar>
                </BarChart>
             </ResponsiveContainer>
           </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center">
           <h3 className="text-lg font-bold text-slate-800 mb-2 w-full">Taxa de Aprovação</h3>
           <div className="h-64 w-full flex items-center justify-center relative">
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                   <Pie
                     data={pieData}
                     cx="50%"
                     cy="50%"
                     innerRadius={60}
                     outerRadius={80}
                     paddingAngle={5}
                     dataKey="value"
                     stroke="none"
                   >
                     {pieData.map((entry, index) => (
                       <Cell key={`cell-${index}`} fill={entry.fill} />
                     ))}
                   </Pie>
                   <Tooltip />
                 </PieChart>
               </ResponsiveContainer>
               <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-bold text-slate-800">{Math.round((stats.approved / stats.totalStudents) * 100)}%</span>
                  <span className="text-xs text-slate-500 uppercase tracking-wider font-bold">Aprovados</span>
               </div>
           </div>
        </div>
      </div>

      {/* Relatório de Séries */}
      {!selectedTurma && stats.seriesChartData && stats.seriesChartData.length > 0 && (
         <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
           <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Users size={20} className="text-indigo-500" />
              Comparativo por Série (Sextos, Sétimos, etc)
           </h3>
           <div className="h-72 w-full">
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.seriesChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="Aprovados" fill="#10b981" radius={[4, 4, 0, 0]} stackId="a" />
                  <Bar dataKey="Reprovados" fill="#f43f5e" radius={[4, 4, 0, 0]} stackId="a" />
                </BarChart>
             </ResponsiveContainer>
           </div>
         </div>
      )}
    </div>
  );
}
