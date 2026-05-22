import React, { useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, FileCheck, Search, Trophy, Plus, Copy, Trash2, Download } from "lucide-react";
import { useLocalStorage } from "../hooks/useLocalStorage";

interface GradeRecord {
  id: string;
  studentName: string;
  grade: number | "";
}

export default function SchoolAssessments({ defaultTab = "bimestral" }: { defaultTab?: "bimestral" | "simulado" }) {
  const [activeTab, setActiveTab] = useState<"bimestral" | "simulado">(defaultTab);
  const [searchTerm, setSearchTerm] = useState("");

  const [turmasList] = useLocalStorage<string[]>(
    "classTurmasList",
    [
      "6°A - Orientação de estudos",
      "6°B - Matemática",
      "6°C - Matemática",
      "7°C - Matemática",
      "7°D - Tecnologia e Eletivas"
    ]
  );
  
  const [selectedTurma, setSelectedTurma] = useLocalStorage<string | null>("assessments_selectedTurma", null);

  const [gradesData, setGradesData] = useLocalStorage<Record<string, GradeRecord[]>>("assessments_grades", {});

  const currentKey = `${selectedTurma}_${activeTab}`;
  const currentGrades = gradesData[currentKey] || [];

  const [newStudent, setNewStudent] = useState("");
  const [newGrade, setNewGrade] = useState("");

  const handleAddGrade = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.trim()) return;

    const parsedGrade = newGrade === "" ? "" : parseFloat(newGrade);
    
    const newRecord: GradeRecord = {
      id: crypto.randomUUID(),
      studentName: newStudent,
      grade: Number.isNaN(parsedGrade) ? "" : parsedGrade,
    };

    setGradesData(prev => ({
      ...prev,
      [currentKey]: [...(prev[currentKey] || []), newRecord]
    }));

    setNewStudent("");
    setNewGrade("");
  };

  const updateGrade = (id: string, newGradeValue: string) => {
    const val = newGradeValue === "" ? "" : parseFloat(newGradeValue);
    setGradesData(prev => ({
       ...prev,
       [currentKey]: prev[currentKey].map(g => g.id === id ? { ...g, grade: Number.isNaN(val) ? "" : val } : g)
    }));
  };

  const removeGrade = (id: string) => {
    setGradesData(prev => ({
       ...prev,
       [currentKey]: prev[currentKey].filter(g => g.id !== id)
    }));
  };

  const generateReport = () => {
    const reprovados = currentGrades.filter(g => typeof g.grade === 'number' && g.grade < 5);
    if (reprovados.length === 0) {
      alert("Nenhum aluno reprovado nesta lista.");
      return;
    }

    let text = `Relatório de Alunos Reprovados - ${activeTab === 'bimestral' ? 'Avaliação Bimestral' : 'Simulado'}\n`;
    text += `Turma: ${selectedTurma}\n\n`;
    reprovados.forEach(r => {
      text += `- ${r.studentName} | Nota: ${r.grade}\n`;
    });

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Reprovados_${selectedTurma}_${activeTab}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyReport = () => {
    const reprovados = currentGrades.filter(g => typeof g.grade === 'number' && g.grade < 5);
    if (reprovados.length === 0) {
      alert("Nenhum aluno reprovado nesta lista.");
      return;
    }

    let text = `Relatório de Alunos Reprovados - ${activeTab === 'bimestral' ? 'Avaliação Bimestral' : 'Simulado'}\n`;
    text += `Turma: ${selectedTurma}\n\n`;
    reprovados.forEach(r => {
      text += `- ${r.studentName} | Nota: ${r.grade}\n`;
    });

    navigator.clipboard.writeText(text);
    alert("Copiado para a área de transferência!");
  };

  if (!selectedTurma) {
    return (
      <div className="flex flex-col h-full bg-slate-50/50">
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {!turmasList || turmasList.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-dashed border-slate-300">
              <BookOpen className="w-12 h-12 text-slate-400 mb-4" />
              <h2 className="text-xl font-bold text-slate-800 mb-2">Nenhuma Turma Adicionada</h2>
            </div>
          ) : (
            turmasList.map((turma) => (
              <motion.div
                key={turma}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 hover:shadow-md hover:-translate-y-1 transition-all cursor-pointer group"
                onClick={() => setSelectedTurma(turma)}
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <BookOpen size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 leading-tight">
                    {turma}
                  </h3>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    );
  }

  const filteredGrades = currentGrades.filter(g => g.studentName.toLowerCase().includes(searchTerm.toLowerCase()));
  const totalReprovados = currentGrades.filter(g => typeof g.grade === 'number' && g.grade < 5).length;
  const totalAprovados = currentGrades.filter(g => typeof g.grade === 'number' && g.grade >= 5).length;

  return (
    <div className="h-full bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
      <div className="p-4 md:p-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedTurma(null)}
            className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition-colors"
            title="Voltar para turmas"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-right rotate-180"><path d="m9 18 6-6-6-6"/></svg>
          </button>
          <h2 className="text-xl font-bold text-slate-800">{selectedTurma}</h2>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("bimestral")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              activeTab === "bimestral"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <FileCheck size={16} />
            Avaliação Bimestral
          </button>
          <button
            onClick={() => setActiveTab("simulado")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              activeTab === "simulado"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
             <Trophy size={16} />
             Simulado
          </button>
        </div>
      </div>

      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Buscar aluno..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
            <button
               onClick={copyReport}
               className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-xl flex items-center gap-2 transition-colors"
            >
               <Copy size={16} /> Copiar Reprovados ({totalReprovados})
            </button>
            <button
               onClick={generateReport}
               className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 text-sm font-bold rounded-xl flex items-center gap-2 transition-colors"
            >
               <Download size={16} /> Doc Reprovados
            </button>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        <form onSubmit={handleAddGrade} className="mb-6 flex gap-2">
            <input
               type="text"
               placeholder="Nome do Aluno"
               value={newStudent}
               onChange={(e) => setNewStudent(e.target.value)}
               className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
            />
            <input
               type="number"
               step="0.1"
               min="0"
               max="10"
               placeholder="Nota"
               value={newGrade}
               onChange={(e) => setNewGrade(e.target.value)}
               className="w-24 px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
            />
            <button type="submit" className="bg-indigo-600 text-white p-2 rounded-xl hover:bg-indigo-700 transition-colors">
               <Plus size={20} />
            </button>
        </form>

        <div className="flex gap-4 mb-4">
           <div className="px-3 py-1 bg-green-50 text-green-700 rounded-lg text-sm font-bold">
              Aprovados (≥ 5): {totalAprovados}
           </div>
           <div className="px-3 py-1 bg-red-50 text-red-700 rounded-lg text-sm font-bold">
              Abaixo de 5: {totalReprovados}
           </div>
        </div>

        {filteredGrades.length === 0 ? (
           <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300">
              <BookOpen className="w-12 h-12 text-slate-300 mb-4" />
              <h3 className="text-lg font-bold text-slate-700 mb-2">Nenhuma nota registrada</h3>
              <p className="text-sm text-slate-500">Adicione os alunos e notas no formulário acima.</p>
           </div>
        ) : (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGrades.map(record => {
                 const isReprovado = typeof record.grade === 'number' && record.grade < 5;
                 const isAprovado = typeof record.grade === 'number' && record.grade >= 5;

                 return (
                    <div key={record.id} className={`p-4 rounded-xl border flex items-center justify-between ${
                       isReprovado ? 'bg-red-50/50 border-red-200' : isAprovado ? 'bg-green-50/50 border-green-200' : 'bg-white border-slate-200'
                    }`}>
                       <div className="flex-1 truncate mr-4 text-sm font-medium text-slate-700">
                          {record.studentName}
                       </div>
                       <div className="flex items-center gap-2">
                          <input
                             type="number"
                             step="0.1"
                             min="0"
                             max="10"
                             value={record.grade}
                             onChange={(e) => updateGrade(record.id, e.target.value)}
                             className={`w-16 px-2 py-1 text-center font-bold text-sm bg-white border rounded focus:outline-none ${
                                isReprovado ? 'text-red-600 border-red-300' : isAprovado ? 'text-green-600 border-green-300' : 'text-slate-700 border-slate-200'
                             }`}
                          />
                          <button onClick={() => removeGrade(record.id)} className="p-1 text-slate-400 hover:text-red-500 transition-colors">
                             <Trash2 size={16} />
                          </button>
                       </div>
                    </div>
                 )
              })}
           </div>
        )}
      </div>
    </div>
  );
}
