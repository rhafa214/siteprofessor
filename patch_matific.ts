import fs from 'fs';

let content = fs.readFileSync('src/views/CanonicalMatificAnalysisView.tsx', 'utf-8');

// 1. Add repository imports
content = content.replace(
  `import { StudentRepository, EnrollmentRepository } from "../data/repositories";`,
  `import { StudentRepository, EnrollmentRepository, AcademicYearRepository, ClassGroupRepository } from "../data/repositories";\nimport { AcademicYear, ClassGroup } from "../domain";`
);

// 2. Change state variables
content = content.replace(
  `  const [selectedTurma, setSelectedTurma] = useState<string>("");
  const [academicYearId, setAcademicYearId] = useState<string>("2026"); // Mocked for now, canonical flow usually requires selection`,
  `  const [selectedTurma, setSelectedTurma] = useState<string>("");
  const [academicYearId, setAcademicYearId] = useState<string>("");
  
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);`
);

// 3. Add repository refs
content = content.replace(
  `  const matchService = useRef(new AcademicMatchingService());`,
  `  const matchService = useRef(new AcademicMatchingService());
  const yearRepo = useRef(new AcademicYearRepository());
  const classGroupRepo = useRef(new ClassGroupRepository());`
);

// 4. Replace hardcoded turmasList and classGroupId
content = content.replace(
  `  const turmasList = [
    "6°A - Orientação de estudos",
    "6°B - Matemática",
    "6°C - Matemática",
    "7°C - Matemática",
    "8°A - Matemática",
    "Itinerário 1° e 2°",
  ];

  // We should actually get academicYear and classGroup from somewhere, but to preserve UI, we'll map selectedTurma to classGroupId
  const classGroupId = selectedTurma; `,
  `  const classGroupId = selectedTurma;
  
  useEffect(() => {
    if (user) {
      yearRepo.current.getAll(user.uid).then(years => {
        setAcademicYears(years);
        if (years.length > 0) {
          setAcademicYearId(years[0].id);
        }
      });
    }
  }, [user]);

  useEffect(() => {
    if (user && academicYearId) {
      classGroupRepo.current.getByAcademicYear(user.uid, academicYearId).then(groups => {
        setClassGroups(groups);
      });
    } else {
      setClassGroups([]);
    }
  }, [user, academicYearId]);`
);

// 5. Update initial View
const oldInitialView = `    return (
      <div className="max-w-7xl mx-auto p-4 md:p-8 pt-24 space-y-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-blue-100 text-blue-700 rounded-2xl shadow-sm">
            <Gamepad2 size={28} />
          </div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">
            Controle Matific
          </h1>
        </div>
        <p className="text-slate-500 font-medium">Selecione uma turma para carregar o roster canônico.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {turmasList.map(turma => (
            <div key={turma} onClick={() => setSelectedTurma(turma)} className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm cursor-pointer hover:shadow-md transition-all">
              <h3 className="font-bold text-slate-800 mb-4">{turma}</h3>
              <p className="text-sm text-slate-500">Abrir turma</p>
            </div>
          ))}
        </div>
      </div>
    );`;

const newInitialView = `    return (
      <div className="max-w-7xl mx-auto p-4 md:p-8 pt-24 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-blue-100 text-blue-700 rounded-2xl shadow-sm">
                <Gamepad2 size={28} />
              </div>
              <h1 className="text-3xl font-black text-slate-800 tracking-tight">
                Matific Canônico
              </h1>
            </div>
            <p className="text-slate-500 font-medium">Selecione uma turma do seu Cadastro Acadêmico.</p>
          </div>
          <div className="w-full md:w-64">
            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Ano Letivo</label>
            <select
              value={academicYearId}
              onChange={(e) => setAcademicYearId(e.target.value)}
              className="w-full bg-white border border-slate-200 text-slate-800 font-bold rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none"
            >
              {academicYears.map(y => (
                <option key={y.id} value={y.id}>{y.year}</option>
              ))}
              {academicYears.length === 0 && <option value="">Sem anos letivos</option>}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classGroups.map(group => (
            <div key={group.id} onClick={() => setSelectedTurma(group.id)} className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm cursor-pointer hover:shadow-md hover:border-blue-200 transition-all group/card">
              <h3 className="font-bold text-slate-800 mb-2 text-xl group-hover/card:text-blue-600 transition-colors">{group.name}</h3>
              <div className="flex items-center gap-4 text-sm text-slate-500 font-medium">
                {group.grade && <span>Ano: {group.grade}</span>}
                {group.section && <span>Turma: {group.section}</span>}
              </div>
            </div>
          ))}
          {classGroups.length === 0 && (
            <div className="col-span-full p-8 text-center bg-slate-50 rounded-3xl border border-slate-200 border-dashed">
              <p className="text-slate-500 font-medium">Nenhuma turma encontrada para este ano letivo no Cadastro Acadêmico.</p>
            </div>
          )}
        </div>
      </div>
    );`;

content = content.replace(oldInitialView, newInitialView);

// 6. Update Canonical title bar
const oldTitleBar = `            <h1 className="text-3xl font-black text-slate-800 tracking-tight">
              Matific — {selectedTurma}
            </h1>`;
const newTitleBar = `            <h1 className="text-3xl font-black text-slate-800 tracking-tight">
              Matific — {classGroups.find(c => c.id === selectedTurma)?.name || selectedTurma}
            </h1>`;
            
content = content.replace(oldTitleBar, newTitleBar);

fs.writeFileSync('src/views/CanonicalMatificAnalysisView.tsx', content);
