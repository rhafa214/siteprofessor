import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, CheckCircle2, Circle } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';

export default function Tasks() {
  const [tasks, setTasks] = useLocalStorage<{id: number, text: string, done: boolean}[]>('eduTasksPro', []);
  const [input, setInput] = useState('');

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setTasks([{ id: Date.now(), text: input.trim(), done: false }, ...tasks]);
    setInput('');
  };

  const removeTask = (id: number) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  const toggleTask = (id: number) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const completedCount = tasks.filter(t => t.done).length;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-3xl mx-auto space-y-6"
    >
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Sua Checklist</h2>
            <p className="text-sm text-slate-500 mt-1">
              {tasks.length} tarefas no total • {completedCount} concluídas
            </p>
          </div>
        </div>

        <form onSubmit={addTask} className="flex gap-3 mb-8">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Adicionar nova tarefa..." 
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-700 text-lg"
          />
          <button type="submit" className="bg-indigo-600 text-white rounded-xl px-6 font-bold hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200 shrink-0 flex items-center justify-center">
            <Plus size={24} />
          </button>
        </form>

        <ul className="space-y-3">
          <AnimatePresence>
            {tasks.length === 0 && (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                className="text-center p-10 text-slate-400 border-2 border-dashed border-slate-100 rounded-2xl"
              >
                Nenhuma tarefa pendente. Tudo certo por aqui!
              </motion.div>
            )}
            {tasks.map(task => (
              <motion.li 
                key={task.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`flex justify-between items-center p-5 rounded-2xl border transition-all ${
                  task.done 
                    ? 'border-emerald-200 bg-emerald-50/50 text-emerald-800 opacity-60' 
                    : 'border-slate-200 bg-white text-slate-700 shadow-sm hover:border-indigo-300 hover:shadow-md'
                }`}
              >
                <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => toggleTask(task.id)}>
                  <button className={`${task.done ? 'text-emerald-500' : 'text-slate-300 hover:text-indigo-500'} transition-colors`}>
                    {task.done ? <CheckCircle2 size={28} /> : <Circle size={28} />}
                  </button>
                  <span className={`text-lg font-medium transition-all ${task.done ? 'line-through text-emerald-600' : ''}`}>
                    {task.text}
                  </span>
                </div>
                <button 
                  onClick={() => removeTask(task.id)}
                  className="text-slate-300 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={20} />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>
    </motion.div>
  );
}
