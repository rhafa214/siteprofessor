import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AcademicYear, ClassGroup, Enrollment } from '../domain';
import { AcademicYearRepository, ClassGroupRepository, StudentRepository, EnrollmentRepository } from '../data/repositories';
import { BookOpen, Plus, Archive, ChevronRight, ArrowLeft, Users, Upload, MoreHorizontal } from 'lucide-react';
import AcademicImportModal from './AcademicImportModal';

export default function AcademicRegistryView() {
  const { user } = useAuth();
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string | null>(null);
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);
  
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [newClassForm, setNewClassForm] = useState({ grade: '', section: '', name: '' });
  const [createError, setCreateError] = useState('');

  // Sub-view states
  const [viewingClassId, setViewingClassId] = useState<string | null>(null);
  const [enrollments, setEnrollments] = useState<(Enrollment & { studentName: string })[]>([]);
  const [loadingClass, setLoadingClass] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const academicRepo = new AcademicYearRepository();
  const classRepo = new ClassGroupRepository();
  const studentRepo = new StudentRepository();
  const enrollmentRepo = new EnrollmentRepository();

  useEffect(() => {
    if (user) {
      loadYears();
    }
  }, [user]);

  useEffect(() => {
    if (user && selectedYearId) {
      loadClasses(selectedYearId);
    } else {
      setClassGroups([]);
    }
    setViewingClassId(null);
  }, [user, selectedYearId]);

  const loadYears = async () => {
    if (!user) return;
    const years = await academicRepo.getAll(user.uid);
    setAcademicYears(years);
    if (years.length > 0 && !selectedYearId) {
      setSelectedYearId(years.find(y => y.status === 'ACTIVE')?.id || years[0].id);
    }
  };

  const loadClasses = async (yearId: string) => {
    if (!user) return;
    const classes = await classRepo.getByAcademicYear(user.uid, yearId);
    setClassGroups(classes.sort((a, b) => a.name.localeCompare(b.name)));
  };

  const loadClassDetails = async (classId: string) => {
    if (!user) return;
    setViewingClassId(classId);
    setLoadingClass(true);
    try {
      const activeEnrollments = await enrollmentRepo.getActiveByClassGroup(user.uid, classId);
      const enriched = await Promise.all(
        activeEnrollments.map(async (enr) => {
          const student = await studentRepo.getById(user.uid, enr.studentId);
          return {
            ...enr,
            studentName: student ? student.name : 'Aluno desconhecido'
          };
        })
      );
      enriched.sort((a, b) => {
        if (a.callNumber === null && b.callNumber === null) return a.studentName.localeCompare(b.studentName);
        if (a.callNumber === null) return 1;
        if (b.callNumber === null) return -1;
        return a.callNumber - b.callNumber;
      });
      setEnrollments(enriched);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingClass(false);
    }
  };

  const handleCreateYear = async () => {
    if (!user) return;
    const yearStr = prompt('Qual o ano letivo? (ex: 2026)');
    if (!yearStr) return;
    const year = parseInt(yearStr);
    if (isNaN(year)) return alert('Ano inválido');
    
    await academicRepo.create(user.uid, {
      id: `ay_${year}`,
      year,
      name: String(year),
      status: 'ACTIVE'
    });
    loadYears();
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedYearId) return;
    
    const duplicate = classGroups.find(c => 
      c.name.toLowerCase() === newClassForm.name.trim().toLowerCase() ||
      (c.grade === newClassForm.grade && c.section.toLowerCase() === newClassForm.section.trim().toLowerCase())
    );

    if (duplicate) {
      setCreateError('Uma turma com este nome, ou mesma série/seção já existe neste ano letivo.');
      return;
    }

    const id = `cg_${Date.now()}_${Math.random().toString(36).substring(2,9)}`;
    await classRepo.create(user.uid, {
      id,
      academicYearId: selectedYearId,
      name: newClassForm.name.trim(),
      grade: newClassForm.grade,
      section: newClassForm.section.trim(),
      status: 'ACTIVE'
    });

    setShowCreateClass(false);
    setNewClassForm({ grade: '', section: '', name: '' });
    setCreateError('');
    loadClasses(selectedYearId);
  };

  if (viewingClassId) {
    const classGroup = classGroups.find(c => c.id === viewingClassId);
    const academicYear = academicYears.find(y => y.id === selectedYearId);
    return (
      <div className="p-8 max-w-5xl mx-auto h-full overflow-y-auto bg-slate-50">
        <button onClick={() => setViewingClassId(null)} className="inline-flex items-center text-indigo-600 font-semibold hover:text-indigo-800 mb-6 transition">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Voltar para Cadastro Acadêmico
        </button>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{classGroup?.name}</h1>
            <div className="flex gap-4 mt-2 text-sm text-gray-500 font-medium">
              <span className="bg-gray-100 px-2 py-1 rounded">{classGroup?.grade} {classGroup?.section}</span>
              <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {enrollments.length} alunos ativos</span>
            </div>
          </div>
          <div>
            <button 
              onClick={() => setIsImportModalOpen(true)}
              className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 font-bold py-2 px-6 rounded flex items-center gap-2 shadow-sm transition-colors"
            >
              <Upload className="w-4 h-4" />
              IMPORTAR / ATUALIZAR ALUNOS
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loadingClass ? (
            <div className="p-12 text-center text-gray-500">Carregando alunos...</div>
          ) : enrollments.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-500 mb-2">Nenhum aluno ativo nesta turma.</p>
              <p className="text-sm text-gray-400">Utilize o botão de importação (em breve) para carregar alunos.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-20">Nº</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Nome do Aluno</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {enrollments.map(enr => (
                  <tr key={enr.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 text-sm font-semibold text-gray-600">
                      {enr.callNumber !== null && enr.callNumber !== undefined ? enr.callNumber.toString().padStart(2, '0') : '—'}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900">
                      {enr.studentName}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-gray-400 hover:text-gray-600">
                        <MoreHorizontal className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        
        {academicYear && classGroup && (
          <AcademicImportModal
            isOpen={isImportModalOpen}
            onClose={() => setIsImportModalOpen(false)}
            academicYear={academicYear}
            classGroup={classGroup}
            onSuccess={() => {
              setIsImportModalOpen(false);
              loadClassDetails(viewingClassId!);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto h-full overflow-y-auto bg-slate-50">
      <div className="flex items-center mb-8 gap-3">
        <div className="p-3 bg-indigo-100 rounded-lg text-indigo-700">
          <BookOpen className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Cadastro Acadêmico</h1>
          <p className="text-gray-500">Gerencie anos letivos, turmas e alunos de forma unificada.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <label className="font-semibold text-gray-700">Ano Letivo:</label>
            <select
              className="border border-gray-300 rounded p-2 text-gray-800 bg-white"
              value={selectedYearId || ''}
              onChange={(e) => setSelectedYearId(e.target.value)}
            >
              <option value="">Selecione...</option>
              {academicYears.map(y => (
                <option key={y.id} value={y.id}>{y.name} {y.status === 'ARCHIVED' ? '(Arquivado)' : ''}</option>
              ))}
            </select>
          </div>
          <button onClick={handleCreateYear} className="text-indigo-600 font-semibold hover:text-indigo-800 text-sm">
            + NOVO ANO LETIVO
          </button>
        </div>
      </div>

      {selectedYearId && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Turmas</h2>
            <button 
              onClick={() => setShowCreateClass(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 transition"
            >
              <Plus className="w-5 h-5" />
              NOVA TURMA
            </button>
          </div>

          {showCreateClass && (
            <div className="bg-white p-6 rounded-xl border border-indigo-200 shadow-md mb-8">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Criar Turma</h3>
              {createError && <p className="text-red-600 text-sm mb-4">{createError}</p>}
              <form onSubmit={handleCreateClass} className="flex gap-4 items-end">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Série / Ano</label>
                  <select 
                    required
                    className="border border-gray-300 rounded p-2 bg-white w-32"
                    value={newClassForm.grade}
                    onChange={(e) => setNewClassForm({...newClassForm, grade: e.target.value})}
                  >
                    <option value="">...</option>
                    <option value="6º Ano">6º Ano</option>
                    <option value="7º Ano">7º Ano</option>
                    <option value="8º Ano">8º Ano</option>
                    <option value="9º Ano">9º Ano</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Seção / Turma</label>
                  <input 
                    type="text" required maxLength={3}
                    placeholder="Ex: A"
                    className="border border-gray-300 rounded p-2 bg-white w-24 uppercase"
                    value={newClassForm.section}
                    onChange={(e) => setNewClassForm({...newClassForm, section: e.target.value.toUpperCase()})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Nome de Exibição</label>
                  <input 
                    type="text" required
                    placeholder="Ex: 6º A"
                    className="border border-gray-300 rounded p-2 bg-white w-48"
                    value={newClassForm.name}
                    onChange={(e) => setNewClassForm({...newClassForm, name: e.target.value})}
                  />
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="bg-indigo-600 text-white font-bold py-2 px-6 rounded hover:bg-indigo-700">Criar</button>
                  <button type="button" onClick={() => setShowCreateClass(false)} className="bg-gray-100 text-gray-700 font-bold py-2 px-4 rounded hover:bg-gray-200">Cancelar</button>
                </div>
              </form>
            </div>
          )}

          {classGroups.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 border-dashed p-12 text-center">
              <p className="text-gray-500 mb-4">Nenhuma turma cadastrada neste ano letivo.</p>
              <button onClick={() => setShowCreateClass(true)} className="text-indigo-600 font-semibold hover:underline">
                + CRIAR PRIMEIRA TURMA
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {classGroups.map(cg => (
                <div onClick={() => loadClassDetails(cg.id)} key={cg.id} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition cursor-pointer flex flex-col justify-between group">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-800">{cg.name}</h3>
                    <p className="text-gray-500 text-sm mt-1">{cg.grade} {cg.section}</p>
                  </div>
                  <div className="mt-6 flex justify-between items-center text-sm font-semibold text-gray-600">
                    <span>Abrir turma</span>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 transition" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
