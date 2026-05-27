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

    const turmasStats: Record<string, { total: number, excellent: number, regular: number, critical: number, sum: number }> = {};

    let highestGrade: number | null = null;
    let lowestGrade: number | null = null;

    turmas.forEach(turma => {
      // Assuming activeTab is bimestral
      const key = `${selectedBimestre}_${turma}_bimestral`;
      const data = gradesData[key] || [];
      
      const validGrades = data.filter(g => typeof g.grade === 'number') as { studentName: string, grade: number }[];
      allGrades.push(...validGrades.map(g => g.grade));
      
      validGrades.forEach(g => {
         if (highestGrade === null || g.grade > highestGrade) highestGrade = g.grade;
         if (lowestGrade === null || g.grade < lowestGrade) lowestGrade = g.grade;
      });

      turmasStats[turma] = {
        total: validGrades.length,
        excellent: validGrades.filter(g => g.grade > 7).length,
        regular: validGrades.filter(g => g.grade >= 5 && g.grade <= 7).length,
        critical: validGrades.filter(g => g.grade < 5).length,
        sum: validGrades.reduce((acc, g) => acc + g.grade, 0)
      };
    });

    const totalStudents = allGrades.length;
    const excellent = allGrades.filter(g => g > 7).length;
    const regular = allGrades.filter(g => g >= 5 && g <= 7).length;
    const critical = allGrades.filter(g => g < 5).length;
    const average = totalStudents > 0 ? (allGrades.reduce((acc, g) => acc + g, 0) / totalStudents).toFixed(1) : "0.0";

    const chartData = selectedTurma ? 
      (gradesData[`${selectedBimestre}_${selectedTurma}_bimestral`] || [])
        .filter(g => typeof g.grade === 'number')
        .map((g: any) => ({ name: g.studentName, grade: g.grade, fill: g.grade > 7 ? '#10b981' : g.grade >= 5 ? '#f59e0b' : '#f43f5e' }))
      : 
      turmas.map(t => ({
        name: t,
        media: turmasStats[t].total > 0 ? Number((turmasStats[t].sum / turmasStats[t].total).toFixed(1)) : 0,
      }));

    let seriesChartData: any[] = [];
    if (!selectedTurma) {
        // Group by series (e.g. "6º ano", "7º ano")
        const seriesData: Record<string, { total: number, sum: number, excellent: number, regular: number, critical: number }> = {};
        turmas.forEach(t => {
            const seriesMatch = t.match(/^(\d+)°/);
            if (seriesMatch) {
                const sLabel = `${seriesMatch[1]}º anos`;
                if (!seriesData[sLabel]) {
                    seriesData[sLabel] = { total: 0, sum: 0, excellent: 0, regular: 0, critical: 0 };
                }
                const st = turmasStats[t];
                seriesData[sLabel].total += st.total;
                seriesData[sLabel].sum += st.sum;
                seriesData[sLabel].excellent += st.excellent;
                seriesData[sLabel].regular += st.regular;
                seriesData[sLabel].critical += st.critical;
            }
        });
        
        seriesChartData = Object.keys(seriesData).map(k => ({
            name: k,
            Excelente: seriesData[k].excellent,
            Regular: seriesData[k].regular,
            Crítico: seriesData[k].critical,
            Média: seriesData[k].total > 0 ? Number((seriesData[k].sum / seriesData[k].total).toFixed(1)) : 0
        }));
    }

    return {
      totalStudents,
      excellent,
      regular,
      critical,
      average,
      chartData,
      seriesChartData,
      highestGrade,
      lowestGrade
    };
  }, [gradesData, selectedBimestre, turmasList, selectedTurma]);

  const pieData = [
    { name: 'Excelente (>7.0)', value: stats.excellent, fill: '#10b981' },
    { name: 'Regular (5.0-7.0)', value: stats.regular, fill: '#f59e0b' },
    { name: 'Crítico (<5.0)', value: stats.critical, fill: '#f43f5e' }
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
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 lg:gap-4">
        <div className="bg-white p-3 lg:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-3">
          <div className="w-10 h-10 lg:w-12 lg:h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
             <Users size={20} className="lg:w-6 lg:h-6" />
          </div>
          <div className="text-center sm:text-left">
            <p className="text-[11px] lg:text-sm font-medium text-slate-500 leading-tight">Alunos</p>
            <p className="text-lg lg:text-2xl font-bold text-slate-800">{stats.totalStudents}</p>
          </div>
        </div>
        <div className="bg-white p-3 lg:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-3">
          <div className="w-10 h-10 lg:w-12 lg:h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
             <FileCheck size={20} className="lg:w-6 lg:h-6" />
          </div>
          <div className="text-center sm:text-left">
            <p className="text-[11px] lg:text-sm font-medium text-slate-500 leading-tight">Excelente</p>
            <p className="text-lg lg:text-2xl font-bold text-slate-800">{stats.excellent}</p>
          </div>
        </div>
        <div className="bg-white p-3 lg:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-3">
          <div className="w-10 h-10 lg:w-12 lg:h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
             <FileCheck size={20} className="lg:w-6 lg:h-6" />
          </div>
          <div className="text-center sm:text-left">
            <p className="text-[11px] lg:text-sm font-medium text-slate-500 leading-tight">Regular</p>
            <p className="text-lg lg:text-2xl font-bold text-slate-800">{stats.regular}</p>
          </div>
        </div>
        <div className="bg-white p-3 lg:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-3">
          <div className="w-10 h-10 lg:w-12 lg:h-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center shrink-0">
             <FileCheck size={20} className="lg:w-6 lg:h-6" />
          </div>
          <div className="text-center sm:text-left">
            <p className="text-[11px] lg:text-sm font-medium text-slate-500 leading-tight">Crítico</p>
            <p className="text-lg lg:text-2xl font-bold text-slate-800">{stats.critical}</p>
          </div>
        </div>
        <div className="bg-white p-3 lg:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-3">
          <div className="w-10 h-10 lg:w-12 lg:h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
             <BrainCircuit size={20} className="lg:w-6 lg:h-6" />
          </div>
          <div className="text-center sm:text-left">
            <p className="text-[11px] lg:text-sm font-medium text-slate-500 leading-tight">Média</p>
            <p className="text-lg lg:text-2xl font-bold text-slate-800">{stats.average}</p>
          </div>
        </div>
        <div className="bg-white p-3 lg:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-3">
          <div className="w-10 h-10 lg:w-12 lg:h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
             <BarChart2 size={20} className="lg:w-6 lg:h-6" />
          </div>
          <div className="text-center sm:text-left flex flex-col">
            <p className="text-[11px] lg:text-sm font-medium text-slate-500 leading-tight">Alta / Baixa</p>
            <p className="text-lg lg:text-xl font-bold text-slate-800 mt-0.5">
               <span className="text-emerald-600">{stats.highestGrade !== null ? stats.highestGrade : "-"}</span> / <span className="text-rose-600">{stats.lowestGrade !== null ? stats.lowestGrade : "-"}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Gráficos / Tabela */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full">
           <h3 className="text-lg font-bold text-slate-800 mb-6">
              {selectedTurma ? `Notas dos Alunos - ${selectedTurma}` : "Média por Turma"}
           </h3>
           
           {selectedTurma ? (
             <div className="flex-1 overflow-x-auto border border-slate-200 rounded-xl">
               <table className="w-full text-left text-sm text-slate-600">
                 <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-xs border-b border-slate-200">
                   <tr>
                     <th className="px-6 py-4">Nome do Aluno</th>
                     <th className="px-6 py-4 text-center">Nota</th>
                     <th className="px-6 py-4 text-center">Situação</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-200 bg-white">
                   {stats.chartData.map((aluno: any, idx: number) => (
                     <tr key={idx} className="hover:bg-slate-50 transition-colors">
                       <td className="px-6 py-3 font-medium text-slate-800">{aluno.name}</td>
                       <td className="px-6 py-3 text-center">
                         <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                           aluno.grade > 7 ? 'bg-emerald-100 text-emerald-700' : 
                           aluno.grade >= 5 ? 'bg-amber-100 text-amber-700' : 
                           'bg-rose-100 text-rose-700'
                         }`}>
                           {aluno.grade}
                         </span>
                       </td>
                       <td className="px-6 py-3 text-center font-medium">
                           {aluno.grade > 7 ? (
                               <span className="text-emerald-600">Excelente</span>
                           ) : aluno.grade >= 5 ? (
                               <span className="text-amber-600">Regular</span>
                           ) : (
                               <span className="text-rose-600">Crítico</span>
                           )}
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
           ) : (
             <div className="w-full h-80">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.chartData as any} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis />
                    <Tooltip cursor={{ fill: '#f1f5f9' }} />
                    <Bar dataKey="media" radius={[4, 4, 0, 0]}>
                      {stats.chartData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill="#6366f1" />
                      ))}
                    </Bar>
                  </BarChart>
               </ResponsiveContainer>
             </div>
           )}
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center">
           <h3 className="text-lg font-bold text-slate-800 mb-2 w-full">Distribuição de Notas</h3>
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
               <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-1">
                  <span className="text-xs text-slate-500 uppercase tracking-wider font-bold">Aprovados</span>
                  <span className="text-2xl font-black text-slate-800 leading-tight">
                    {stats.totalStudents > 0 ? Math.round(((stats.excellent + stats.regular) / stats.totalStudents) * 100) : 0}%
                  </span>
               </div>
           </div>
           <div className="w-full flex justify-center gap-4 mt-2 text-xs">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-emerald-500"></div><span className="text-slate-600 font-medium">Excel.</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-amber-500"></div><span className="text-slate-600 font-medium">Regul.</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-rose-500"></div><span className="text-slate-600 font-medium">Crítico</span></div>
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
                  <Bar dataKey="Excelente" fill="#10b981" radius={[4, 4, 0, 0]} stackId="a" />
                  <Bar dataKey="Regular" fill="#f59e0b" radius={[4, 4, 0, 0]} stackId="a" />
                  <Bar dataKey="Crítico" fill="#f43f5e" radius={[4, 4, 0, 0]} stackId="a" />
                </BarChart>
             </ResponsiveContainer>
           </div>
         </div>
      )}
    </div>
  );
}
