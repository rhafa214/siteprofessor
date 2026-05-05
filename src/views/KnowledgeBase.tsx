import { useState, useEffect } from 'react';
import { Brain, FileSpreadsheet, Save, Loader2, Info, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { SP_MATH_CURRICULUM } from '../lib/spMath';

export default function KnowledgeBase() {
  const { user } = useAuth();
  const [curriculumData, setCurriculumData] = useState<string>('');
  const [schoolModelData, setSchoolModelData] = useState<string>('');
  const [isSavingCurriculum, setIsSavingCurriculum] = useState(false);
  const [isSavingModel, setIsSavingModel] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadKnowledge() {
      if (!user) return;
      try {
        const curDoc = await getDoc(doc(db, 'users', user.uid, 'knowledge', 'curriculum'));
        if (curDoc.exists() && curDoc.data()?.text) {
          setCurriculumData(curDoc.data().text);
        }
        
        const modDoc = await getDoc(doc(db, 'users', user.uid, 'knowledge', 'schoolModel'));
        if (modDoc.exists() && modDoc.data()?.text) {
          setSchoolModelData(modDoc.data().text);
        }
      } catch (err) {
        console.error("Error loading knowledge", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadKnowledge();
  }, [user]);

  const saveCurriculum = async () => {
    if (!user) return;
    setIsSavingCurriculum(true);
    try {
      await setDoc(doc(db, 'users', user.uid, 'knowledge', 'curriculum'), { text: curriculumData, updatedAt: new Date().toISOString() });
    } catch (error) {
      console.error(error);
    } finally {
      setIsSavingCurriculum(false);
    }
  };

  const saveModel = async () => {
    if (!user) return;
    setIsSavingModel(true);
    try {
      await setDoc(doc(db, 'users', user.uid, 'knowledge', 'schoolModel'), { text: schoolModelData, updatedAt: new Date().toISOString() });
    } catch (error) {
      console.error(error);
    } finally {
      setIsSavingModel(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="animate-spin text-indigo-500" size={32} />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 space-y-6 lg:space-y-8 max-w-5xl mx-auto pb-24">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 lg:p-8 text-white relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>
        
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-white/10 rounded-2xl border border-white/20 backdrop-blur-sm">
              <Brain size={32} className="text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-black tracking-tight mb-2">Treinamento do Jarvis</h1>
              <p className="text-slate-400 font-medium max-w-lg leading-relaxed text-sm lg:text-base">
                Forneça os documentos do Estado (Currículo, Planilhas) e os modelos da sua escola para que o assistente conheça exatamente o que você precisa trabalhar no ano.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Curriculo do Estado */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col h-[500px]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <FileSpreadsheet size={20} />
              </div>
              <h2 className="text-lg font-bold text-slate-800 tracking-tight">O que ensinar? (Matriz)</h2>
            </div>
            
            <button
              onClick={() => setCurriculumData(SP_MATH_CURRICULUM)}
              title="Preencher com Currículo Paulista de Matemática (6º ao 8º ano)"
              className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
            >
              <Sparkles size={14} />
              Currículo SP (Mat)
            </button>
          </div>
          
          <div className="mb-4 text-sm text-slate-600 space-y-2 flex-grow-0">
             <p className="flex gap-2 items-start bg-blue-50 p-3 rounded-xl border border-blue-100 text-blue-800">
               <Info size={16} className="mt-0.5 shrink-0" />
               <span>Cole aqui o conteúdo da planilha do Estado (Currículo Paulista, habilidades, materiais). Pode copiar as células da planilha e colar direto aqui.</span>
             </p>
          </div>
          
          <div className="flex-1 min-h-0 mb-4">
            <textarea
              className="w-full h-full p-4 text-sm border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none font-mono"
              placeholder="Cole os dados da planilha aqui...&#10;Ex:&#10;Habilidade: EF06LP01&#10;Objeto de conhecimento: Reconstrução das condições de produção e recepção de textos..."
              value={curriculumData}
              onChange={(e) => setCurriculumData(e.target.value)}
            />
          </div>
          <button 
            onClick={saveCurriculum}
            disabled={isSavingCurriculum}
            className="flex items-center justify-center gap-2 w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all disabled:opacity-50"
          >
            {isSavingCurriculum ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Salvar Matriz Curricular
          </button>
        </div>

        {/* Modelo de Plano da Escola */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col h-[500px]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-pink-50 text-pink-600 rounded-xl">
                <Brain size={20} />
              </div>
              <h2 className="text-lg font-bold text-slate-800 tracking-tight">Como ensinar? (Modelo)</h2>
            </div>
          </div>

          <div className="mb-4 text-sm text-slate-600 space-y-2 flex-grow-0">
             <p className="flex gap-2 items-start bg-indigo-50 p-3 rounded-xl border border-indigo-100 text-indigo-800">
               <Info size={16} className="mt-0.5 shrink-0" />
               <span>Cole aqui o modelo de plano de aula que a sua escola exige. O Jarvis usará isso como base ao criar os seus planejamentos.</span>
             </p>
          </div>
          
          <div className="flex-1 min-h-0 mb-4">
            <textarea
              className="w-full h-full p-4 text-sm border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:pink-500 focus:border-transparent resize-none font-mono"
              placeholder="Cole o modelo de plano aqui...&#10;Ex:&#10;1. Tema da Aula&#10;2. Competências e Habilidades&#10;3. Metodologia / Estratégias&#10;4. Avaliação"
              value={schoolModelData}
              onChange={(e) => setSchoolModelData(e.target.value)}
            />
          </div>
          
          <button 
             onClick={saveModel}
             disabled={isSavingModel}
            className="flex items-center justify-center gap-2 w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all disabled:opacity-50"
          >
            {isSavingModel ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Salvar Modelo da Escola
          </button>
        </div>
      </div>
    </div>
  );
}
