import { useState } from 'react';
import { motion } from 'motion/react';
import { Save, CheckCircle2 } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';

export default function LessonPlan() {
  const [content, setContent] = useLocalStorage('eduPlan', '');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    // Already saved to local storage by the hook, just show feedback
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-5xl mx-auto h-[calc(100vh-140px)] flex flex-col gap-6"
    >
      <div className="flex justify-between items-center bg-white p-4 lg:p-6 rounded-3xl border border-slate-200 shadow-sm shrink-0">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Editor de Plano de Aula</h2>
          <p className="text-sm text-slate-500">Seus dados são salvos localmente.</p>
        </div>
        <button 
          onClick={handleSave}
          className="bg-indigo-600 text-white px-6 py-3 shrink-0 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 focus:ring-4 focus:ring-indigo-100"
        >
          {saved ? <CheckCircle2 size={20} /> : <Save size={20} />}
          {saved ? 'Salvo!' : 'Salvar Plano'}
        </button>
      </div>

      <div className="flex-1 rounded-3xl border border-slate-200 shadow-sm overflow-hidden bg-white">
        <textarea 
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Comece a digitar seu plano de aula..." 
          className="w-full h-full resize-none p-8 font-medium text-slate-700 text-lg leading-relaxed focus:outline-none focus:ring-inset focus:ring-4 focus:ring-indigo-50/50 bg-slate-50 placeholder:text-slate-300"
        ></textarea>
      </div>
    </motion.div>
  );
}
