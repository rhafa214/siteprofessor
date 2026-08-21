import re

with open("src/views/LegacyMatificAnalysisView.tsx", "r") as f:
    content = f.read()

# 1. Replace saveClassData to be a no-op
saveClassData_regex = re.compile(r'const saveClassData = async \(newData: ClassData\) => \{.*?\};\n', re.DOTALL)
content = saveClassData_regex.sub(r'''const saveClassData = async (newData: ClassData) => {
    console.warn("Legacy mode is read-only. Bypassing saveClassData.");
    showAlert("O modo legado é somente leitura. Edições foram desabilitadas.", "Aviso", "info");
  };
''', content)

# 2. Add badge to the title
content = content.replace(
    '<h1 className="text-3xl font-black text-slate-800 tracking-tight">\n              Controle Matific\n            </h1>',
    '<h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-4">\n              Controle Matific\n              <span className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-md border border-amber-200">\n                Registro legado — somente leitura\n              </span>\n            </h1>'
)

# 3. Change subtitle
content = content.replace(
    '<p className="text-slate-500 font-medium">\n            Acompanhe o engajamento no Matific e obtenha médias. 30 minutos =\n            Nota 10.\n          </p>',
    '<p className="text-slate-500 font-medium">\n            Visualização do histórico antigo. As edições estão desabilitadas.\n          </p>'
)

# 4. Remove actions in the cards
# Replace counting logic
counting_regex = re.compile(
r'''let studentsCount = 0;
                  let weeksCount = 0;
                  if \(localData\) \{
                    try \{
                      const parsed = JSON\.parse\(localData\);
                      studentsCount = parsed\.students\?\.length \|\| 0;
                      weeksCount = parsed\.weeks\?\.length \|\| 0;
                    \} catch \(e\) \{\}
                  \}'''
)
content = counting_regex.sub(r'''let studentsCount = 0;
                  let weeksCount = 0;
                  let hasLocalData = false;
                  if (localData) {
                    try {
                      const parsed = JSON.parse(localData);
                      studentsCount = parsed.students?.length || 0;
                      weeksCount = parsed.weeks?.length || 0;
                      hasLocalData = true;
                    } catch (e) {}
                  }''', content)

# Card text replacement
card_text = r'''<span className="flex items-center gap-1">
                            <Users size={14} /> {studentsCount} Alunos
                          </span>
                          <span className="flex items-center gap-1">
                            <Gamepad2 size={14} /> {weeksCount} Semanas
                          </span>'''
content = content.replace(card_text, r'''{hasLocalData ? (
                            <>
                              <span className="flex items-center gap-1">
                                <Users size={14} /> {studentsCount} Alunos
                              </span>
                              <span className="flex items-center gap-1">
                                <Gamepad2 size={14} /> {weeksCount} Semanas
                              </span>
                            </>
                          ) : (
                            <span className="text-slate-400">
                              Clique para consultar o histórico
                            </span>
                          )}''')

# 5. Empty history message
empty_state = r'''<h3 className="text-xl font-bold text-slate-700 mb-2">
                          Nenhum aluno cadastrado nesta turma
                        </h3>
                        <p className="text-slate-500">
                          Clique em "Adicionar Alunos" para colar a lista da sua
                          turma.
                        </p>'''
content = content.replace(empty_state, r'''<h3 className="text-xl font-bold text-slate-700 mb-2">
                          Histórico Vazio
                        </h3>
                        <p className="text-slate-500">
                          Não foram encontrados registros legados de alunos e resultados para esta turma neste período.
                        </p>''')

# 6. Remove action buttons in header
header_buttons = r'''<button
                          onClick={() => setIsImportModalOpen(true)}
                          className={`flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl font-bold text-sm shadow-sm transition-colors`}
                        >
                          <Users size={16} /> Alunos da Turma
                        </button>
                        {!studentMode && (
                          <button
                            onClick={() => setIsAddingWeek(!isAddingWeek)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white border border-blue-700 rounded-xl font-bold text-sm shadow-sm transition-colors hover:bg-blue-700"
                          >
                            <Plus size={16} /> Nova Semana
                          </button>
                        )}'''
content = content.replace(header_buttons, '{/* Ocultado no Legado */}')

# 7. Remove edit icons
remove_student_button = r'''<button
                                    onClick={() => removeStudent(student.id)}
                                    className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                                    title="Remover Aluno"
                                  >
                                    <X size={16} />
                                  </button>'''
content = content.replace(remove_student_button, '{/* Ocultado no Legado */}')

remove_week_button = r'''<button
                                    onClick={() => removeWeek(week.id)}
                                    className="text-slate-400 hover:text-red-600 transition-colors p-1.5 bg-white rounded-md shadow-sm border border-slate-200"
                                    title="Remover Semana"
                                  >
                                    <Trash2 size={12} />
                                  </button>'''
content = content.replace(remove_week_button, '{/* Ocultado no Legado */}')

# 8. Disable inputs
input_box_regex = re.compile(
r'''<input
                                        type="number"
                                        min="0"
                                        value=\{
                                          val === null \|\| val === undefined
                                            \? ""
                                            : val
                                        \}
                                        onChange=\{\(e\) =>
                                          handleScoreChange\(
                                            student\.id,
                                            week\.id,
                                            e\.target\.value,
                                          \)
                                        \}
                                        onBlur=\{handleGradeBlur\}
                                        className=\{`w-full bg-transparent border-b-2 px-2 py-1 text-center font-bold text-sm focus:outline-none focus:bg-white focus:rounded focus:shadow-sm transition-all \$\{.*?`\}
                                      />''', re.DOTALL)
                                      
content = input_box_regex.sub(r'''<input
                                        type="number"
                                        readOnly
                                        value={
                                          val === null || val === undefined
                                            ? ""
                                            : val
                                        }
                                        className={`w-full bg-transparent border-b-2 px-2 py-1 text-center font-bold text-sm focus:outline-none transition-all cursor-default opacity-90 ${
                                          val === undefined ||
                                          val === null ||
                                          String(val) === ""
                                            ? "border-slate-200 text-slate-700"
                                            : val >= 30
                                              ? "border-emerald-300 text-emerald-700 bg-emerald-50/50"
                                              : val >= 20
                                                ? "border-blue-300 text-blue-700 bg-blue-50/50"
                                                : "border-amber-300 text-amber-700 bg-amber-50/50"
                                        }`}
                                      />''', content)

# 9. Header saving indicator
saving_indicator = r'''{isSaving ? (
                          <>
                            <Loader2 size={12} className="animate-spin" />{" "}
                            Salvando...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={12} /> Salvo
                          </>
                        )}'''
content = content.replace(saving_indicator, '<CheckCircle2 size={12} /> Somente leitura')

# 10. Delete turma
delete_turma = r'''<button
                        onClick={(e) => handleDeleteTurma(e, turma)}
                        className="absolute top-4 right-4 p-2 text-slate-300 hover:bg-red-50 hover:text-red-500 rounded-xl transition-colors opacity-0 group-hover:opacity-100"
                        title="Excluir Turma"
                      >
                        <Trash2 size={18} />
                      </button>'''
content = content.replace(delete_turma, '')

with open("src/views/LegacyMatificAnalysisView.tsx", "w") as f:
    f.write(content)
