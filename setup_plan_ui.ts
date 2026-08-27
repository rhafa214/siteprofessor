import fs from "fs";

const content = `import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { GradePlanService } from "../services/academic/GradePlanService";
import { CanonicalGradePlan, CanonicalGradeComponent } from "../domain/assessment/GradePlanTypes";
import { db } from "../lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { Save, Plus, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import { useAlert } from "../contexts/AlertContext";

export default function GradePlanConfigView({ selectedBimestre }: { selectedBimestre: string }) {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  
  const [turmasList, setTurmasList] = useState<{id: string, name: string}[]>([]);
  const [selectedTurma, setSelectedTurma] = useState<string | null>(null);
  
  const [plan, setPlan] = useState<CanonicalGradePlan | null>(null);
  const [components, setComponents] = useState<CanonicalGradeComponent[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [termId, setTermId] = useState<string>("term_3");
  const [academicYearId, setAcademicYearId] = useState<string>("year_2024");

  useEffect(() => {
    if (!user) return;
    const loadClasses = async () => {
      const q = query(collection(db, "users", user.uid, "classGroups"), where("status", "==", "ACTIVE"));
      const snap = await getDocs(q);
      const classes = snap.docs.map(d => ({ id: d.id, name: d.data().name }));
      if (classes.length > 0) {
         setTurmasList(classes);
      } else {
         const legacy = localStorage.getItem("classTurmasList");
         if (legacy) setTurmasList(JSON.parse(legacy).map((n: string) => ({ id: n, name: n })));
      }
    };
    loadClasses();
  }, [user]);

  useEffect(() => {
    if (!user || !selectedTurma || !selectedBimestre) return;
    const loadPlan = async () => {
      setLoading(true);
      try {
        const gradePlanService = new GradePlanService();
        const bKey = selectedBimestre.replace("º Bimestre", "").trim();
        const tId = \`term_\${bKey}\`;
        setTermId(tId);

        let activePlan = await gradePlanService.getActiveGradePlan(user.uid, academicYearId, tId, selectedTurma);
        
        if (activePlan) {
          setPlan(activePlan);
          const comps = await gradePlanService.getGradeComponents(user.uid, activePlan.id);
          setComponents(comps);
        } else {
          // Initialize a new default plan for this term based on the requirements
          setPlan(null);
          
          const newComps: CanonicalGradeComponent[] = [
             { id: 'new_1', gradePlanId: '', key: 'PAULISTA', label: 'Prova Paulista', weight: 30, sourceType: 'PROVA_PAULISTA', enabled: true, order: 1 },
             { id: 'new_2', gradePlanId: '', key: 'BIMESTRAL', label: 'Avaliação', weight: 30, sourceType: 'MANUAL', enabled: true, order: 2 },
             { id: 'new_3', gradePlanId: '', key: 'TAREFA', label: 'Tarefas', weight: 20, sourceType: 'TASK_ANALYSIS', enabled: true, order: 3 },
             { id: 'new_4', gradePlanId: '', key: 'MATIFIC', label: 'Matific', weight: 10, sourceType: 'MATIFIC', enabled: true, order: 4 },
             { id: 'new_5', gradePlanId: '', key: 'PARTICIPACAO', label: 'Participação', weight: 10, sourceType: 'MANUAL', enabled: true, order: 5 },
          ];
          setComponents(newComps);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadPlan();
  }, [user, selectedTurma, selectedBimestre, academicYearId]);

  const totalWeight = components.reduce((sum, c) => sum + (c.enabled ? Number(c.weight) : 0), 0);
  const isValid = totalWeight === 100;

  const handleWeightChange = (index: number, val: string) => {
    const newComps = [...components];
    newComps[index].weight = Number(val) || 0;
    setComponents(newComps);
  };

  const handleToggle = (index: number) => {
    const newComps = [...components];
    newComps[index].enabled = !newComps[index].enabled;
    setComponents(newComps);
  };

  const handleSave = async (activate: boolean) => {
    if (activate && !isValid) {
      showAlert("O total de pesos deve ser exatamente 100% para ativar o plano.", "error");
      return;
    }
    if (!user || !selectedTurma) return;

    setSaving(true);
    try {
      const gradePlanService = new GradePlanService();
      
      const newPlanId = \`plan_\${academicYearId}_\${termId}_\${selectedTurma}_\${Date.now()}\`;
      
      const newPlan: CanonicalGradePlan = {
        id: newPlanId,
        uid: user.uid,
        academicYearId,
        termId,
        classGroupId: selectedTurma,
        version: plan ? plan.version + 1 : 1,
        status: activate ? 'ACTIVE' : 'DRAFT',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const finalComps = components.map((c, idx) => ({
        ...c,
        id: c.id.startsWith('new_') ? \`comp_\${newPlanId}_\${c.key}_\${Date.now()}\` : \`comp_\${newPlanId}_\${c.key}\`,
        gradePlanId: newPlanId,
        order: idx + 1
      }));

      if (activate) {
        await gradePlanService.activateGradePlan(user.uid, newPlan, finalComps, plan?.id);
        showAlert("Plano ativado com sucesso!", "success");
      } else {
        await gradePlanService.saveDraft(user.uid, newPlan, finalComps);
        showAlert("Rascunho salvo com sucesso!", "success");
      }
      
      setPlan(newPlan);
      setComponents(finalComps);

    } catch (e) {
      console.error(e);
      showAlert("Erro ao salvar o plano.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (!selectedTurma) {
    return (
      <div className="flex-1 overflow-auto bg-slate-50/50 p-6 flex flex-col gap-6">
        <h1 className="text-2xl font-black text-slate-800">Plano de Avaliação</h1>
        <p className="text-slate-500">Selecione uma turma para configurar os pesos da Média Final.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {turmasList.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTurma(t.id)}
              className="p-6 bg-white rounded-3xl border border-slate-100 hover:border-indigo-200 hover:shadow-lg transition-all text-left group flex justify-between items-center"
            >
              <div>
                <h3 className="font-bold text-slate-700 text-lg">{t.name}</h3>
                <p className="text-sm text-slate-400 mt-1">Configurar pesos</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-slate-50/50 p-6 flex flex-col gap-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div>
          <button
            onClick={() => setSelectedTurma(null)}
            className="text-sm font-bold text-indigo-600 hover:text-indigo-700 mb-2 flex items-center gap-1"
          >
            ← Voltar
          </button>
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                Plano de Avaliação: {turmasList.find(t => t.id === selectedTurma)?.name || selectedTurma}
              </h1>
              <p className="text-sm font-medium text-slate-500 mt-1">
                {selectedBimestre} {plan && \`• Versão \${plan.version}\`}
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors"
          >
            Salvar Rascunho
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving || !isValid}
            className={\`px-6 py-2 font-bold rounded-xl flex items-center gap-2 transition-colors \${
              isValid ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "bg-slate-100 text-slate-400 cursor-not-allowed"
            }\`}
          >
            <CheckCircle2 size={18} /> Ativar Plano
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-slate-700">Composição da Média</h2>
          <div className={\`px-4 py-2 rounded-xl font-black flex items-center gap-2 \${
            isValid ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"
          }\`}>
            {!isValid && <AlertCircle size={16} />}
            TOTAL: {totalWeight}%
          </div>
        </div>

        {loading ? (
           <p className="text-slate-400">Carregando plano...</p>
        ) : (
          <div className="space-y-4">
            {components.map((comp, idx) => (
              <div key={comp.id} className={\`flex items-center justify-between p-4 rounded-xl border \${comp.enabled ? 'border-slate-200 bg-slate-50' : 'border-slate-100 bg-white opacity-50'}\`}>
                <div className="flex items-center gap-4">
                  <input
                    type="checkbox"
                    checked={comp.enabled}
                    onChange={() => handleToggle(idx)}
                    className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <p className="font-bold text-slate-700">{comp.label}</p>
                    <p className="text-xs text-slate-400 uppercase tracking-wider">{comp.sourceType}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    disabled={!comp.enabled}
                    value={comp.weight}
                    onChange={(e) => handleWeightChange(idx, e.target.value)}
                    className="w-20 px-3 py-2 bg-white border border-slate-200 rounded-lg text-center font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
                  />
                  <span className="text-slate-500 font-bold">%</span>
                </div>
              </div>
            ))}
            
            <button
              onClick={() => {
                setComponents([
                  ...components,
                  { id: \`new_custom_\${Date.now()}\`, gradePlanId: '', key: \`CUSTOM_\${Date.now()}\`, label: 'Novo Componente', weight: 0, sourceType: 'CUSTOM', enabled: true, order: components.length + 1 }
                ]);
              }}
              className="w-full py-4 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 font-bold hover:bg-slate-50 hover:border-slate-300 transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={18} /> Adicionar Componente
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
`;
fs.writeFileSync("src/views/GradePlanConfigView.tsx", content);
