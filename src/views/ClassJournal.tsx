import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { Plus, Search, Book } from 'lucide-react';

interface ClassLog {
  id: number;
  data: string;
  turma: string;
  progresso: string;
}

export default function ClassJournal() {
  const [logs, setLogs] = useLocalStorage<ClassLog[]>('classLogs', []);
  const [turmasList, setTurmasList] = useLocalStorage<string[]>('classTurmasList', ['1º A', '2º B', '3º C']);
  const [turma, setTurma] = useState('');
  const [progresso, setProgresso] = useState('');
  const [search, setSearch] = useState('');
  const [novaTurma, setNovaTurma] = useState('');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!turma.trim() || !progresso.trim()) return;
    
    const newLog: ClassLog = {
      id: Date.now(),
      data: new Date().toLocaleDateString('pt-BR'),
      turma: turma.trim(),
      progresso: progresso.trim()
    };
    
    setLogs([newLog, ...logs]);
    // Reset inputs, preserving the selected class if useful
    setProgresso('');
  };

  const handleAddTurma = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaTurma.trim() || turmasList.includes(novaTurma.trim())) return;
    setTurmasList([...turmasList, novaTurma.trim()]);
    setNovaTurma('');
  };

  const handleRemoveTurma = (t: string) => {
    setTurmasList(turmasList.filter(item => item !== t));
  };

  const filteredLogs = logs.filter(l => 
    l.turma.toLowerCase().includes(search.toLowerCase()) || 
    l.progresso.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-5xl mx-auto space-y-6"
    >
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800 mb-4">Novo Registro Diário</h2>
        <form onSubmit={handleSave} className="flex flex-col md:flex-row gap-4">
          <select 
            value={turma}
            onChange={(e) => setTurma(e.target.value)}
            className="md:w-1/4 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
          >
            <option value="" disabled>Selecione a Turma</option>
            {turmasList.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input 
            type="text" 
            value={progresso}
            onChange={(e) => setProgresso(e.target.value)}
            placeholder="Conteúdo lecionado, observações, progresso..." 
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
          />
          <button type="submit" className="bg-indigo-600 text-white rounded-xl px-6 py-3 font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 shrink-0 shadow-md shadow-indigo-200">
            <Plus size={18} /> Registrar
          </button>
        </form>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800 mb-4">Minhas Turmas Atuais</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          {turmasList.map(t => (
            <div key={t} className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-4 py-2 rounded-xl flex items-center gap-2 font-bold text-sm">
              {t} 
              <button 
                onClick={() => handleRemoveTurma(t)}
                className="text-indigo-400 hover:text-indigo-600 focus:outline-none"
              >
                &times;
              </button>
            </div>
          ))}
          {turmasList.length === 0 && <span className="text-slate-500 text-sm italic">Você não tem turmas cadastradas.</span>}
        </div>
        <form onSubmit={handleAddTurma} className="flex gap-3 max-w-sm">
          <input 
            type="text"
            value={novaTurma}
            onChange={(e) => setNovaTurma(e.target.value)}
            placeholder="Adicionar turma (ex: 3º D)"
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
          />
          <button type="submit" className="bg-white border border-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl shadow-sm hover:bg-slate-50 text-sm">
            Adicionar
          </button>
        </form>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[500px]">
        <div className="p-4 lg:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h2 className="font-bold text-slate-800">Histórico de Aulas</h2>
          <div className="relative w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar histórico..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-auto">
          {filteredLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8">
              <Book size={48} className="mb-4 text-slate-200" />
              <p>Nenhum registro encontrado.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-white sticky top-0 border-b border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                <tr>
                  <th className="font-bold text-slate-500 text-xs uppercase tracking-wider py-4 px-6">Data</th>
                  <th className="font-bold text-slate-500 text-xs uppercase tracking-wider py-4 px-6 w-32">Turma</th>
                  <th className="font-bold text-slate-500 text-xs uppercase tracking-wider py-4 px-6">Conteúdo / Progresso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6 text-sm text-slate-500 whitespace-nowrap">{log.data}</td>
                    <td className="py-4 px-6 font-bold text-indigo-700 whitespace-nowrap">{log.turma}</td>
                    <td className="py-4 px-6 text-slate-700">{log.progresso}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </motion.div>
  );
}
