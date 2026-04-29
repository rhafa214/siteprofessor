import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, CheckCircle2, Circle, AlertCircle, Calendar } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';

type Priority = 'low' | 'medium' | 'high';

interface Task {
  id: number;
  text: string;
  done: boolean;
  priority?: Priority;
  dueDate?: string;
}

export default function Tasks() {
  const [tasks, setTasks] = useLocalStorage<Task[]>('eduTasksPro', []);
  const [input, setInput] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [dueDate, setDueDate] = useState('');

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setTasks([{ id: Date.now(), text: input.trim(), done: false, priority, dueDate }, ...tasks]);
    setInput('');
    setPriority('medium');
    setDueDate('');
  };

  const removeTask = (id: number) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  const toggleTask = (id: number) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const completedCount = tasks.filter(t => t.done).length;

  const priorityColors = {
    low: 'bg-slate-100 text-slate-600 border-slate-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    high: 'bg-red-100 text-red-700 border-red-200'
  };

  const priorityLabels = {
    low: 'Baixa',
    medium: 'Normal',
    high: 'Alta'
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto space-y-6 pb-10"
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

        <form onSubmit={addTask} className="flex flex-col md:flex-row gap-3 mb-8 bg-slate-50 p-4 rounded-2xl border border-slate-100">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Adicionar nova tarefa..." 
            className="flex-1 bg-white border border-slate-200 rounded-xl px-5 py-3 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-slate-700"
          />
          <div className="flex gap-3">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className="bg-white border border-slate-200 text-slate-600 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 font-medium text-sm"
            >
              <option value="low">Prioridade Baixa</option>
              <option value="medium">Prioridade Normal</option>
              <option value="high">Prioridade Alta</option>
            </select>
            <input 
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="bg-white border border-slate-200 text-slate-600 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 text-sm font-medium"
            />
            <button type="submit" className="bg-indigo-600 text-white rounded-xl px-6 font-bold hover:bg-indigo-700 transition-colors shadow-sm shrink-0 flex items-center justify-center">
              <Plus size={20} />
            </button>
          </div>
        </form>

        <ul className="space-y-3">
          <AnimatePresence>
            {tasks.length === 0 && (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                className="text-center p-10 text-slate-400 border-2 border-dashed border-slate-100 rounded-2xl font-medium"
              >
                Nenhuma tarefa pendente. Tudo certo por aqui!
              </motion.div>
            )}
            {tasks.sort((a,b) => {
              if(a.done === b.done) return 0;
              return a.done ? 1 : -1;
            }).map(task => (
              <motion.li 
                key={task.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`flex justify-between items-center p-4 rounded-2xl border transition-all ${
                  task.done 
                    ? 'border-emerald-200 bg-emerald-50/50 text-emerald-800 opacity-60' 
                    : 'border-slate-200 bg-white text-slate-700 shadow-sm hover:border-indigo-300 hover:shadow-md'
                }`}
              >
                <div className="flex items-center gap-4 flex-1 cursor-pointer overflow-hidden" onClick={() => toggleTask(task.id)}>
                  <button className={`${task.done ? 'text-emerald-500' : 'text-slate-300 hover:text-indigo-500'} transition-colors shrink-0`}>
                    {task.done ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                  </button>
                  <div className="flex flex-col min-w-0">
                    <span className={`text-lg font-medium truncate transition-all ${task.done ? 'line-through text-emerald-600' : ''}`}>
                      {task.text}
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      {task.priority && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${task.done ? 'opacity-50' : priorityColors[task.priority]}`}>
                          {priorityLabels[task.priority]}
                        </span>
                      )}
                      {task.dueDate && (
                        <span className={`flex items-center gap-1 text-[11px] font-bold ${task.done ? 'text-emerald-600' : 'text-slate-400'}`}>
                          <Calendar size={12} />
                          {new Date(task.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => removeTask(task.id)}
                  className="text-slate-300 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors shrink-0 ml-4"
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
