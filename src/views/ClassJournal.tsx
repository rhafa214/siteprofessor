import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { Plus, Search, Book, Folder, FolderOpen, Trash2, Edit2, Save, X } from 'lucide-react';

interface ClassLog {
  id: number;
  data: string;
  aulaNumero: string;
  turma: string;
  progresso: string;
}

export default function ClassJournal() {
  const [logs, setLogs] = useLocalStorage<ClassLog[]>('classLogs', []);
  const [turmasList, setTurmasList] = useLocalStorage<string[]>('classTurmasList', [
    '6°A - Orientação de estudos',
    '6°B - Matemática',
    '6°C - Matemática',
    '7°C - Matemática',
    '8°A - Matemática',
    '8°C - Matemática'
  ]);
  
  const today = new Date().toISOString().split('T')[0];
  const [dataAula, setDataAula] = useState(today);
  const [aulaNumero, setAulaNumero] = useState('1');
  const [turma, setTurma] = useState('');
  const [progresso, setProgresso] = useState('');
  const [search, setSearch] = useState('');
  const [novaTurma, setNovaTurma] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  const [editingLogId, setEditingLogId] = useState<number | null>(null);
  const [editTurma, setEditTurma] = useState<string>('');
  const [editProgresso, setEditProgresso] = useState<string>('');

  const handleDeleteLog = (id: number) => {
    if (confirm('Tem certeza que deseja excluir este registro?')) {
      setLogs(logs.filter(log => log.id !== id));
    }
  };

  const startEditLog = (log: ClassLog) => {
    setEditingLogId(log.id);
    setEditTurma(log.turma);
    setEditProgresso(log.progresso);
  };

  const cancelEditLog = () => {
    setEditingLogId(null);
    setEditTurma('');
    setEditProgresso('');
  };

  const saveEditLog = (id: number) => {
    setLogs(logs.map(log => 
      log.id === id ? { ...log, turma: editTurma, progresso: editProgresso } : log
    ));
    setEditingLogId(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!turma.trim() || !progresso.trim()) return;
    
    const newLog: ClassLog = {
      id: Date.now(),
      data: new Date(dataAula + 'T12:00:00').toLocaleDateString('pt-BR'),
      aulaNumero: aulaNumero,
      turma: turma.trim(),
      progresso: progresso.trim()
    };
    
    setLogs([newLog, ...logs]);
    setProgresso('');
    setSelectedFolder(turma.trim()); // Switch to the folder of the added item
  };

  const handleAddTurma = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaTurma.trim() || turmasList.includes(novaTurma.trim())) return;
    setTurmasList([...turmasList, novaTurma.trim()]);
    setNovaTurma('');
  };

  const handleRemoveTurma = (t: string) => {
    setTurmasList(turmasList.filter(item => item !== t));
    if (selectedFolder === t) setSelectedFolder(null);
  };

  const filteredLogs = logs.filter(l => {
    const matchesSearch = l.turma.toLowerCase().includes(search.toLowerCase()) || 
                          l.progresso.toLowerCase().includes(search.toLowerCase());
    const matchesFolder = selectedFolder ? l.turma === selectedFolder : true;
    return matchesSearch && matchesFolder;
  });

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-5xl mx-auto space-y-6"
    >
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800 mb-4">Novo Registro Diário</h2>
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row gap-4">
            <input 
              type="date"
              value={dataAula}
              onChange={(e) => setDataAula(e.target.value)}
              className="md:w-auto bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-sm"
              required
            />
            <select 
              value={aulaNumero}
              onChange={(e) => setAulaNumero(e.target.value)}
              className="md:w-32 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-sm"
              required
            >
              <option value="1">1ª Aula</option>
              <option value="2">2ª Aula</option>
              <option value="3">3ª Aula</option>
              <option value="4">4ª Aula</option>
              <option value="5">5ª Aula</option>
              <option value="6">6ª Aula</option>
              <option value="7">7ª Aula</option>
            </select>
            <select 
              value={turma}
              onChange={(e) => setTurma(e.target.value)}
              className="md:w-1/3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
              required
            >
              <option value="" disabled>Selecione a Turma</option>
              {turmasList.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex flex-col md:flex-row gap-4">
            <input 
              type="text" 
              value={progresso}
              onChange={(e) => setProgresso(e.target.value)}
              placeholder="Conteúdo lecionado, observações, progresso..." 
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
              required
            />
            <button type="submit" className="bg-indigo-600 text-white rounded-xl px-6 py-3 font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 shrink-0 shadow-md shadow-indigo-200">
              <Plus size={18} /> Registrar
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <h2 className="text-lg font-bold text-slate-800">Minhas Turmas Atuais</h2>
        </div>
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

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
        <div className="p-4 lg:p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
          <div className="flex items-center gap-3">
             <h2 className="font-bold text-slate-800">
               {selectedFolder ? `Histórico de: ${selectedFolder}` : 'Histórico Geral de Aulas'}
             </h2>
             {selectedFolder && (
               <button onClick={() => setSelectedFolder(null)} className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors">Ver todas as turmas</button>
             )}
          </div>
          <div className="relative w-full md:w-64">
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
        
        <div className="px-4 lg:px-6 pt-4 pb-2 border-b border-slate-100 bg-slate-50">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-200">
            <button 
              onClick={() => setSelectedFolder(null)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border font-bold text-sm whitespace-nowrap transition-all ${selectedFolder === null ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'}`}
            >
              <Book size={18} /> Todos os Registros
            </button>
            {turmasList.map(t => (
              <button 
                onClick={() => setSelectedFolder(t)}
                key={t}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border font-bold text-sm whitespace-nowrap transition-all ${selectedFolder === t ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'}`}
              >
                {selectedFolder === t ? <FolderOpen size={18} className="fill-indigo-400 text-white" /> : <Folder size={18} className="fill-slate-200 text-slate-400" />} {t}
              </button>
            ))}
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
                  <th className="font-bold text-slate-500 text-xs uppercase tracking-wider py-4 px-6 w-24">Aula</th>
                  <th className="font-bold text-slate-500 text-xs uppercase tracking-wider py-4 px-6 w-48">Turma</th>
                  <th className="font-bold text-slate-500 text-xs uppercase tracking-wider py-4 px-6">Conteúdo / Progresso</th>
                  <th className="font-bold text-slate-500 text-xs uppercase tracking-wider py-4 px-6 text-right w-24">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6 text-sm text-slate-500 whitespace-nowrap">{log.data}</td>
                    <td className="py-4 px-6 font-bold text-slate-700 whitespace-nowrap">{log.aulaNumero}ª</td>
                    <td className="py-4 px-6">
                      {editingLogId === log.id ? (
                        <select 
                          value={editTurma}
                          onChange={(e) => setEditTurma(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-700 focus:outline-none focus:border-indigo-500"
                        >
                          {turmasList.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      ) : (
                        <span className="font-bold text-indigo-700 whitespace-nowrap">{log.turma}</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-slate-700">
                      {editingLogId === log.id ? (
                        <input 
                          type="text"
                          value={editProgresso}
                          onChange={(e) => setEditProgresso(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-700 focus:outline-none focus:border-indigo-500"
                        />
                      ) : (
                        log.progresso
                      )}
                    </td>
                    <td className="py-4 px-6 text-right whitespace-nowrap">
                      {editingLogId === log.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => saveEditLog(log.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Salvar">
                            <Save size={16} />
                          </button>
                          <button onClick={cancelEditLog} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors" title="Cancelar">
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2 text-slate-400">
                          <button onClick={() => startEditLog(log)} className="p-1.5 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Editar/Mover">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => handleDeleteLog(log.id)} className="p-1.5 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Excluir">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </td>
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
