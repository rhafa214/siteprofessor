import React, { useState, useEffect } from "react";
import { StudentRepository, EnrollmentRepository } from "../data/repositories";
import { AcademicYearRepository } from "../data/repositories/AcademicYearRepository";
import { ClassGroupRepository } from "../data/repositories/ClassGroupRepository";
import { AcademicRosterService, CanonicalStudentRoster } from "../services/academic/AcademicRosterService";
import { CanonicalAssessmentService } from "../services/academic/CanonicalAssessmentService";
import { AcademicTermService, AcademicTerm } from "../services/academic/AcademicTermService";
import { CanonicalAssessmentSheet, CanonicalAssessmentResult, AssessmentCategory } from "../domain/assessment/AssessmentTypes";
import { useAuth } from "../contexts/AuthContext";
import { useAlert } from "../contexts/AlertContext";
import { Loader2, Save, Download, Copy, History, Upload } from "lucide-react";
import DriveFolderPickerModal from "../components/DriveFolderPickerModal";
import { Packer, Document, Paragraph, TextRun, Table, WidthType, BorderStyle, TableRow, TableCell, AlignmentType, ShadingType } from "docx";


interface CanonicalAssessmentViewProps {
  category: AssessmentCategory;
  selectedBimestreLabel: string;
  onSwitchToLegacy: () => void;
}

export default function CanonicalAssessmentView({
  category,
  selectedBimestreLabel,
  onSwitchToLegacy
}: CanonicalAssessmentViewProps) {
  const { user, accessToken } = useAuth();
  const [isDrivePickerOpen, setIsDrivePickerOpen] = useState(false);
  const [reportBlobData, setReportBlobData] = useState<{blob: Blob, fileName: string} | null>(null);
  const { showAlert } = useAlert();

  const [years, setYears] = useState<{ id: string, year: number }[]>([]);
  const [classes, setClasses] = useState<{ id: string, name: string }[]>([]);
  
  const [selectedYearId, setSelectedYearId] = useState<string>("");
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  
  const [term, setTerm] = useState<AcademicTerm | null>(null);
  
  const [roster, setRoster] = useState<CanonicalStudentRoster[]>([]);
  const [sheet, setSheet] = useState<CanonicalAssessmentSheet | null>(null);
  const [resultsMap, setResultsMap] = useState<Map<string, CanonicalAssessmentResult>>(new Map());
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // For edited values in memory before saving
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [editedGrades, setEditedGrades] = useState<Map<string, string>>(new Map());

  const rosterService = new AcademicRosterService(new StudentRepository(), new EnrollmentRepository());
  const assessmentService = new CanonicalAssessmentService();
  const termService = new AcademicTermService();

  useEffect(() => {
    const loadFilters = async () => {
      const yrRepo = new AcademicYearRepository();
      const allYears = await yrRepo.getAll(user!.uid);
      setYears(allYears);
      if (allYears.length > 0) {
        setSelectedYearId(allYears[0].id);
      }
    };
    loadFilters();
  }, [user]);

  useEffect(() => {
    if (!selectedYearId) return;
    const loadClasses = async () => {
      const clsRepo = new ClassGroupRepository();
      const allClasses = await clsRepo.getByAcademicYear(user!.uid, selectedYearId);
      setClasses(allClasses);
      if (allClasses.length > 0) {
        setSelectedClassId(allClasses[0].id);
      } else {
        setSelectedClassId("");
      }
    };
    loadClasses();
  }, [selectedYearId, user]);

  useEffect(() => {
    if (!selectedYearId) return;
    const yearObj = years.find(y => y.id === selectedYearId);
    if (yearObj) {
      const matchedTerm = termService.getTerm(yearObj.year, selectedBimestreLabel);
      setTerm(matchedTerm);
    }
  }, [selectedYearId, selectedBimestreLabel, years]);

  useEffect(() => {
    if (!selectedYearId || !selectedClassId || !term) {
      setRoster([]);
      setSheet(null);
      setResultsMap(new Map());
      setLoading(false);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        const activeRoster = await rosterService.getActiveRoster(user!.uid, selectedYearId, selectedClassId);
        setRoster(activeRoster);

        const currentSheet = await assessmentService.getSheet(user!.uid, selectedYearId, term.termNumber, selectedClassId, category);
        
        let loadedResults = new Map<string, CanonicalAssessmentResult>();
        let initialGrades = new Map<string, string>();
        
        if (currentSheet) {
          setSheet(currentSheet);
          setTitle(currentSheet.title);
          setDate(currentSheet.date || "");
          
          const results = await assessmentService.getResults(user!.uid, currentSheet.id);
          results.forEach(r => {
            loadedResults.set(r.studentId, r);
            if (r.grade !== null && r.grade !== undefined) {
              initialGrades.set(r.studentId, String(r.grade));
            }
          });
        } else {
          setSheet(null);
          setTitle("");
          setDate("");
        }
        
        setResultsMap(loadedResults);
        setEditedGrades(initialGrades);
      } catch (err) {
        console.error(err);
        showAlert("Erro ao carregar dados", "error");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedYearId, selectedClassId, term, category, user]);

  const handleGradeChange = (studentId: string, val: string) => {
    setEditedGrades(prev => {
      const m = new Map(prev);
      if (val === "") m.delete(studentId);
      else m.set(studentId, val);
      return m;
    });
  };

  const saveAll = async () => {
    if (!selectedYearId || !selectedClassId || !term) return;
    setSaving(true);
    try {
      const sheetId = `sheet_${selectedYearId}_${term.termNumber}_${selectedClassId}_${category}`;
      const updatedSheet: CanonicalAssessmentSheet = {
        id: sheetId,
        uid: user!.uid,
        academicYearId: selectedYearId,
        termId: term.termNumber,
        classGroupId: selectedClassId,
        category,
        title,
        date: date || null,
        maxScore: 10,
        createdAt: sheet?.createdAt || Date.now(),
        updatedAt: Date.now()
      };

      await assessmentService.upsertSheet(updatedSheet);
      
      const newResults: CanonicalAssessmentResult[] = roster.map(student => {
        const valStr = editedGrades.get(student.studentId);
        const gradeNum = valStr ? parseFloat(valStr) : null;
        
        return {
          id: `result_${sheetId}_${student.studentId}`,
          uid: user!.uid,
          assessmentId: sheetId,
          studentId: student.studentId,
          grade: (gradeNum !== null && !isNaN(gradeNum)) ? gradeNum : null,
          createdAt: resultsMap.get(student.studentId)?.createdAt || Date.now(),
          updatedAt: Date.now()
        };
      });

      await assessmentService.saveResults(user!.uid, sheetId, newResults);
      setSheet(updatedSheet);
      
      const newResultsMap = new Map<string, CanonicalAssessmentResult>();
      newResults.forEach(r => newResultsMap.set(r.studentId, r));
      setResultsMap(newResultsMap);
      
      showAlert("Notas salvas com sucesso!", "success");
    } catch (e) {
      console.error(e);
      showAlert("Erro ao salvar", "error");
    } finally {
      setSaving(false);
    }
  };

  const generateReport = async () => {
    const reprovados = roster.filter(s => {
       const val = editedGrades.get(s.studentId);
       if (!val) return false;
       const grade = parseFloat(val);
       return !isNaN(grade) && grade < 5;
    });
    
    if (reprovados.length === 0) {
      showAlert("Nenhum aluno reprovado nesta lista.", "info");
      return;
    }

    const table = new Table({
      width: { size: 10000, type: WidthType.DXA },
      columnWidths: [8000, 2000],
      borders: {
        top: { style: BorderStyle.SINGLE, size: 2, color: "E2E8F0" },
        bottom: { style: BorderStyle.SINGLE, size: 2, color: "E2E8F0" },
        left: { style: BorderStyle.SINGLE, size: 2, color: "E2E8F0" },
        right: { style: BorderStyle.SINGLE, size: 2, color: "E2E8F0" },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
      },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: "Nome do Estudante", bold: true, color: "334155" })] })],
              shading: { type: ShadingType.CLEAR, fill: "F8FAFC" },
              margins: { top: 200, bottom: 200, left: 200, right: 200 },
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: "Nota", bold: true, color: "334155" })], alignment: AlignmentType.CENTER })],
              shading: { type: ShadingType.CLEAR, fill: "F8FAFC" },
              margins: { top: 200, bottom: 200, left: 200, right: 200 },
            }),
          ],
        }),
        ...reprovados.map(s => {
          return new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: s.name })] })],
                margins: { top: 200, bottom: 200, left: 200, right: 200 },
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: editedGrades.get(s.studentId) || "", bold: true, color: "DC2626" })], alignment: AlignmentType.CENTER })],
                margins: { top: 200, bottom: 200, left: 200, right: 200 },
              }),
            ],
          });
        }),
      ],
    });

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            children: [new TextRun({ text: `Relatório de Reprovados - ${category}`, bold: true, size: 32 })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),
          table,
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Reprovados_${category}_${term?.termNumber}Bim.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Preparar para o Drive se o usuário clicar no botão do Drive
    setReportBlobData({ blob, fileName: "Reprovados_" + category + "_" + (term?.termNumber || 1) + "Bim.docx" });
  };


  const handleUploadToDrive = async (folderId: string, folderName: string) => {
    if (!reportBlobData || !accessToken) {
      showAlert("Autenticação necessária para o Drive.", "error");
      return;
    }
    try {
      showAlert("Iniciando upload para o Google Drive...", "info");
      setIsDrivePickerOpen(false);
      
      const metadata = {
        name: reportBlobData.fileName,
        parents: [folderId],
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      };

      const formData = new FormData();
      formData.append(
        "metadata",
        new Blob([JSON.stringify(metadata)], { type: "application/json" })
      );
      formData.append("file", reportBlobData.blob);

      const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + accessToken,
        },
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Falha no upload");
      }

      showAlert("Relatório salvo no Google Drive com sucesso!", "success");
    } catch (e) {
      console.error(e);
      showAlert("Erro ao salvar no Drive.", "error");
    }
  };

  const copyReport = () => {
    const reprovados = roster.filter(s => {
       const val = editedGrades.get(s.studentId);
       if (!val) return false;
       const grade = parseFloat(val);
       return !isNaN(grade) && grade < 5;
    });
    if (reprovados.length === 0) {
      showAlert("Nenhum aluno reprovado nesta lista.", "info");
      return;
    }
    let text = `Relatório de Alunos Reprovados - ${category}\n`;
    reprovados.forEach((s) => {
      text += `${s.name} - Nota: ${editedGrades.get(s.studentId)}\n`;
    });
    navigator.clipboard.writeText(text);
    showAlert("Lista de reprovados copiada para a área de transferência!", "success");
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="bg-white border-b border-slate-200 p-4 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            <h2 className="text-xl font-bold text-slate-800">
              {category === "BIMESTRAL" && "Avaliação Bimestral"}
              {category === "SIMULADO" && "Simulado"}
              {category === "PARTICIPACAO" && "Participação"}
            </h2>
            <div className="flex items-center gap-2">
              <select
                value={selectedYearId}
                onChange={e => setSelectedYearId(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {years.map(y => <option key={y.id} value={y.id}>{y.year}</option>)}
              </select>
              <select
                value={selectedClassId}
                onChange={e => setSelectedClassId(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Selecione a turma...</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <button
            onClick={onSwitchToLegacy}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 font-bold text-sm rounded-xl hover:bg-slate-200 transition-colors"
          >
            <History size={16} /> Modo Legado
          </button>
        </div>
      </div>

      <div className="p-4 border-b border-slate-100 bg-white flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex gap-2 flex-1 w-full max-w-lg">
          <input
            type="text"
            placeholder="Título da Avaliação"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-40 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex gap-2">
           <button
            onClick={copyReport}
            className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-xl flex items-center gap-2 transition-colors shrink-0"
          >
            <Copy size={16} /> Copiar
          </button>
          <button
            onClick={generateReport}
            className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 text-sm font-bold rounded-xl flex items-center gap-2 transition-colors shrink-0"
          >
            <Download size={16} /> Reprovados
          </button>
          {accessToken && (
            <button
              onClick={() => {
                if (!reportBlobData) {
                  generateReport().then(() => setIsDrivePickerOpen(true));
                } else {
                  setIsDrivePickerOpen(true);
                }
              }}
              className="px-4 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-100 text-sm font-bold rounded-xl flex items-center gap-2 transition-colors shrink-0"
            >
              <Upload size={16} /> Drive
            </button>
          )}
          <button
            onClick={saveAll}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white font-bold text-sm rounded-xl hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Salvar Notas
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-white p-4">
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : !selectedClassId ? (
          <div className="flex justify-center items-center h-40 text-slate-500 font-bold text-sm">
            Selecione uma turma para carregar os alunos.
          </div>
        ) : roster.length === 0 ? (
          <div className="flex justify-center items-center h-40 text-slate-500 font-bold text-sm">
            Nenhum aluno ativo nesta turma.
          </div>
        ) : (
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 sticky top-0 z-10 backdrop-blur-sm">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-12 text-center">Nº</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Aluno</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-32 text-center">Nota</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-32 text-center">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {roster.map((enrollment, index) => {
                const sId = enrollment.studentId;
                const valStr = editedGrades.get(sId);
                const isLancado = valStr !== undefined && valStr !== "";
                const gradeNum = isLancado ? parseFloat(valStr) : null;
                const isReprovado = gradeNum !== null && gradeNum < 5;
                const isAprovado = gradeNum !== null && gradeNum >= 5;

                return (
                  <tr key={sId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-3 text-sm font-medium text-slate-400 text-center">
                      {String(enrollment.callNumber).padStart(2, '0')}
                    </td>
                    <td className="px-6 py-3 text-sm font-bold text-slate-700">
                      {enrollment.name}
                    </td>
                    <td className="px-6 py-3 flex justify-center">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="10"
                        value={valStr || ""}
                        onChange={e => handleGradeChange(sId, e.target.value)}
                        className={`w-20 px-3 py-1.5 text-center font-bold text-sm bg-white border rounded lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
                          isReprovado
                            ? "text-red-700 border-red-300 bg-red-50"
                            : isAprovado
                              ? "text-green-700 border-green-300 bg-green-50"
                              : "text-slate-700 border-slate-200"
                        }`}
                      />
                    </td>
                    <td className="px-6 py-3 text-center">
                      {isLancado ? (
                        <span className="inline-block px-2 py-1 bg-teal-50 text-teal-700 text-xs font-bold rounded-lg border border-teal-100">Lançado</span>
                      ) : (
                        <span className="inline-block px-2 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-lg border border-amber-100">Não lançado</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <DriveFolderPickerModal
        isOpen={isDrivePickerOpen}
        onClose={() => setIsDrivePickerOpen(false)}
        onSelect={handleUploadToDrive}
        accessToken={accessToken!}
      />
    </div>
  );
}
