import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { Plus, Search, Book, Folder, FolderOpen, Trash2, Edit2, Save, X, ChevronDown } from 'lucide-react';
import { collection, doc, setDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

interface ClassLog {
  id: number;
  data: string;
  aulaNumero: string;
  turma: string;
  progresso: string;
}

export default function ClassJournal() {
  const { user } = useAuth();
  const [logs, setLogs] = useLocalStorage<ClassLog[]>('classLogs', []);
  const [turmasList, setTurmasList] = useLocalStorage<string[]>('classTurmasList', [
    '6°A - Orientação de estudos',
    '6°B - Matemática',
    '6°C - Matemática',
    '7°C - Matemática',
    '8°A - Matemática',
    '8°C - Matemática'
  ]);
  
  useEffect(() => {
    if (user) {
      const fetchLogs = async () => {
        try {
          const snap = await getDocs(collection(db, 'users', user.uid, 'classLogs'));
          const fbLogs: ClassLog[] = [];
          snap.forEach(d => fbLogs.push(d.data() as ClassLog));
          if (fbLogs.length > 0) {
            setLogs(fbLogs);
          } else if (logs.length > 0) {
            logs.forEach(async (log) => {
              try { await setDoc(doc(db, 'users', user.uid, 'classLogs', log.id.toString()), log); } catch(e) {}
            });
          }
        } catch (e) { console.error('Error fetching logs', e); }
      };
      fetchLogs();
    }
  }, [user]);

  const today = new Date().toISOString().split('T')[0];
  const [dataAula, setDataAula] = useState(today);
  const [aulasSelecionadas, setAulasSelecionadas] = useState<number[]>([1]);
  const [isAulasDropdownOpen, setIsAulasDropdownOpen] = useState(false);
  const [turma, setTurma] = useState('');
  const [progresso, setProgresso] = useState('');
  const [search, setSearch] = useState('');
  const [novaTurma, setNovaTurma] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  const toggleAula = (aulaNum: number) => {
    setAulasSelecionadas(prev => 
      prev.includes(aulaNum)
        ? prev.filter(a => a !== aulaNum)
        : [...prev, aulaNum].sort((a, b) => a - b)
    );
  };

  const [editingLogId, setEditingLogId] = useState<number | null>(null);
  const [editTurma, setEditTurma] = useState<string>('');
  const [editProgresso, setEditProgresso] = useState<string>('');

  const handleDeleteLog = (id: number) => {
    if (confirm('Tem certeza que deseja excluir este registro?')) {
      setLogs(logs.filter(log => log.id !== id));
      if (user) {
        deleteDoc(doc(db, 'users', user.uid, 'classLogs', id.toString())).catch(e => console.error(e));
      }
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
    const updated = { turma: editTurma, progresso: editProgresso };
    setLogs(logs.map(log => 
      log.id === id ? { ...log, ...updated } : log
    ));
    setEditingLogId(null);
    if (user) {
      const logToUpdate = logs.find(log => log.id === id);
      if (logToUpdate) {
        setDoc(doc(db, 'users', user.uid, 'classLogs', id.toString()), { ...logToUpdate, ...updated }).catch(e => console.error(e));
      }
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!turma.trim() || !progresso.trim()) return;
    
    const newLog: ClassLog = {
      id: Date.now(),
      data: new Date(dataAula + 'T12:00:00').toLocaleDateString('pt-BR'),
      aulaNumero: aulasSelecionadas.length > 0 ? aulasSelecionadas.map(a => `${a}ª`).join(', ') : '1ª',
      turma: turma.trim(),
      progresso: progresso.trim()
    };
    
    setLogs([newLog, ...logs]);
    setProgresso('');
    setSelectedFolder(turma.trim()); // Switch to the folder of the added item
    if (user) {
      setDoc(doc(db, 'users', user.uid, 'classLogs', newLog.id.toString()), newLog).catch(e => console.error(e));
    }
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
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            <input 
              type="date"
              value={dataAula}
              onChange={(e) => setDataAula(e.target.value)}
              className="md:w-auto bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-sm"
              required
            />
            <div 
              className="relative w-full md:w-56 bg-slate-50 border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all text-sm font-medium"
              tabIndex={0}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setIsAulasDropdownOpen(false);
                }
              }}
            >
              <div 
                className="px-4 py-3 cursor-pointer flex items-center justify-between"
                onClick={() => setIsAulasDropdownOpen(!isAulasDropdownOpen)}
              >
                <span className="text-slate-700 truncate pr-2">
                  {aulasSelecionadas.length > 0 ? (aulasSelecionadas.length > 3 ? `${aulasSelecionadas.length} aulas sel.` : aulasSelecionadas.map(a => `${a}ª`).join(', ') + ' Aula' + (aulasSelecionadas.length > 1 ? 's' : '')) : 'Aulas no dia'}
                </span>
                <ChevronDown size={16} className={`text-slate-400 shrink-0 transition-transform ${isAulasDropdownOpen ? 'rotate-180' : ''}`} />
              </div>
              
              {isAulasDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-full bg-white border border-slate-200 rounded-xl shadow-xl z-20 py-2 flex flex-col gap-1 max-h-60 overflow-y-auto">
                  <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Aulas</div>
                  {[1, 2, 3, 4, 5, 6, 7].map(num => (
                    <label key={num} className="flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 cursor-pointer w-full transition-colors">
                      <input
                        type="checkbox"
                        checked={aulasSelecionadas.includes(num)}
                        onChange={() => toggleAula(num)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 max-w-none focus:ring-2 border-slate-300"
                      />
                      <span className="text-sm font-medium text-slate-700">{num}ª Aula</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <select 
              value={turma}
              onChange={(e) => setTurma(e.target.value)}
              className="w-full md:w-1/3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-sm"
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
                    <td className="py-4 px-6 font-bold text-slate-700 whitespace-nowrap">{log.aulaNumero.includes('ª') ? log.aulaNumero : `${log.aulaNumero}ª`}</td>
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
