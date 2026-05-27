import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  FileCheck,
  Search,
  Trophy,
  Plus,
  Copy,
  Trash2,
  Download,
  Users,
  Loader2,
  FolderOpen,
} from "lucide-react";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ShadingType,
} from "docx";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { useAuth } from "../contexts/AuthContext";
import { useAlert } from "../contexts/AlertContext";
import { useConfirm } from "../contexts/ConfirmContext";
import { usePrompt } from "../contexts/PromptContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import DriveFolderPickerModal from "../components/DriveFolderPickerModal";
import BimestralReportView from "../components/BimestralReportView";

interface GradeRecord {
  id: string;
  studentName: string;
  grade: number | "";
}

export default function SchoolAssessments({
  defaultTab = "bimestral",
  selectedBimestre,
}: {
  defaultTab?: "bimestral" | "simulado" | "participacao";
  selectedBimestre: string;
}) {
  const { user, accessToken } = useAuth();
  const { showAlert } = useAlert();
  const { confirm } = useConfirm();
  const { prompt } = usePrompt();
  const [activeTab, setActiveTab] = useState<
    "bimestral" | "simulado" | "participacao"
  >(defaultTab);
  const [isSyncing, setIsSyncing] = useState(false);

  const [turmasList] = useLocalStorage<string[]>("classTurmasList", [
    "6°A - Orientação de estudos",
    "6°B - Matemática",
    "6°C - Matemática",
    "7°C - Matemática",
    "7°D - Tecnologia e Eletivas",
  ]);

  const [selectedTurma, setSelectedTurma] = useState<string | null>(null);

  const [gradesData, setGradesData] = useLocalStorage<
    Record<string, GradeRecord[]>
  >("assessments_grades", {});
  const [assessmentsMeta, setAssessmentsMeta] = useLocalStorage<
    Record<string, { title: string; date: string }>
  >("assessments_meta", {});

  const [isDrivePickerOpen, setIsDrivePickerOpen] = useState(false);
  const [reportDataToSave, setReportDataToSave] = useState<{
    fileName: string;
    blob: Blob;
  } | null>(null);

  const bKey = selectedBimestre.replace("º Bimestre", "");
  const currentKey = `${selectedBimestre}_${selectedTurma}_${activeTab}`;
  const oldKey = `${selectedTurma}_${activeTab}`;

  let currentGrades = gradesData[currentKey];
  let currentMeta = assessmentsMeta[currentKey];

  if (!currentGrades && bKey === "2") {
    currentGrades = gradesData[oldKey];
  }
  currentGrades = currentGrades || [];

  if (!currentMeta && bKey === "2") {
    currentMeta = assessmentsMeta[oldKey];
  }
  currentMeta = currentMeta || { title: "", date: "" };

  const handleUpdateMeta = (field: "title" | "date", value: string) => {
    setAssessmentsMeta((prev) => ({
      ...prev,
      [currentKey]: {
        ...(prev[currentKey] || prev[oldKey] || { title: "", date: "" }),
        [field]: value,
      },
    }));
  };

  const syncStudentsWithDatabase = async () => {
    if (!user || !selectedTurma) {
      showAlert(
        "Você precisa estar logado para sincronizar com o banco em nuvem.",
        "Aviso",
        "warning",
      );
      return;
    }

    try {
      setIsSyncing(true);
      const bKey = selectedBimestre.replace("º Bimestre", "");
      let snap = await getDoc(
        doc(db, "users", user.uid, "taskAnalysis", selectedTurma),
      );
      if (!snap.exists()) {
        snap = await getDoc(
          doc(
            db,
            "users",
            user.uid,
            "taskAnalysis",
            `${bKey}_${selectedTurma}`,
          ),
        );
      }

      if (snap.exists()) {
        const td = snap.data();
        if (td && td.students && Array.isArray(td.students)) {
          const existingNames = new Set(
            currentGrades.map((s) => s.studentName.toLowerCase()),
          );

          const newRecords: GradeRecord[] = [];
          let added = 0;

          for (const st of td.students) {
            if (!existingNames.has(st.name.toLowerCase())) {
              newRecords.push({
                id: crypto.randomUUID(),
                studentName: st.name,
                grade: "",
              });
              added++;
            }
          }

          if (added > 0) {
            const finalGrades = [...currentGrades, ...newRecords];
            finalGrades.sort((a, b) =>
              a.studentName.localeCompare(b.studentName),
            );

            setGradesData((prev) => ({
              ...prev,
              [currentKey]: finalGrades,
            }));
            showAlert(
              `Sincronização concluída! ${added} novo(s) aluno(s) adicionado(s).`,
              "Sucesso",
              "success",
            );
          } else {
            showAlert(
              "Todos os alunos do banco já estão na lista de notas.",
              "Aviso",
              "info",
            );
          }
        } else {
          showAlert(
            "Nenhum aluno encontrado no banco de dados para esta turma.",
            "Aviso",
            "warning",
          );
        }
      } else {
        showAlert(
          "Turma não encontrada no banco de dados de alunos.",
          "Aviso",
          "warning",
        );
      }
    } catch (e) {
      console.error(e);
      showAlert("Erro ao sincronizar com o banco de alunos.", "Erro", "error");
    } finally {
      setIsSyncing(false);
    }
  };

  const updateGrade = (id: string, newGradeValue: string) => {
    const val = newGradeValue === "" ? "" : parseFloat(newGradeValue);
    setGradesData((prev) => ({
      ...prev,
      [currentKey]: (
        prev[currentKey] ||
        (bKey === "2" ? prev[oldKey] : null) ||
        []
      ).map((g) =>
        g.id === id ? { ...g, grade: Number.isNaN(val) ? "" : val } : g,
      ),
    }));
  };

  const removeGrade = (id: string) => {
    setGradesData((prev) => ({
      ...prev,
      [currentKey]: (
        prev[currentKey] ||
        (bKey === "2" ? prev[oldKey] : null) ||
        []
      ).filter((g) => g.id !== id),
    }));
  };

  const generateReport = async () => {
    const reprovados = currentGrades.filter(
      (g) => typeof g.grade === "number" && g.grade < 5,
    );
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
        insideHorizontal: {
          style: BorderStyle.SINGLE,
          size: 1,
          color: "E2E8F0",
        },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
      },
      rows: [
        // Header Row
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({
              shading: {
                fill: "F1F5F9",
                type: ShadingType.CLEAR,
                color: "auto",
              },
              margins: { top: 100, bottom: 100, left: 150, right: 150 },
              width: { size: 8000, type: WidthType.DXA },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "Nome do Aluno",
                      bold: true,
                      color: "334155",
                      font: "Helvetica",
                    }),
                  ],
                  alignment: AlignmentType.LEFT,
                }),
              ],
            }),
            new TableCell({
              shading: {
                fill: "F1F5F9",
                type: ShadingType.CLEAR,
                color: "auto",
              },
              margins: { top: 100, bottom: 100, left: 150, right: 150 },
              width: { size: 2000, type: WidthType.DXA },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "Nota",
                      bold: true,
                      color: "334155",
                      font: "Helvetica",
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
            }),
          ],
        }),
        // Data Rows
        ...reprovados.map(
          (r) =>
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 8000, type: WidthType.DXA },
                  margins: { top: 80, bottom: 80, left: 150, right: 150 },
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: r.studentName,
                          color: "475569",
                          font: "Helvetica",
                        }),
                      ],
                    }),
                  ],
                }),
                new TableCell({
                  width: { size: 2000, type: WidthType.DXA },
                  margins: { top: 80, bottom: 80, left: 150, right: 150 },
                  shading: {
                    fill: "FEF2F2",
                    type: ShadingType.CLEAR,
                    color: "auto",
                  },
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: r.grade?.toString() || "",
                          color: "DC2626",
                          bold: true,
                          font: "Helvetica",
                        }),
                      ],
                      alignment: AlignmentType.CENTER,
                    }),
                  ],
                }),
              ],
            }),
        ),
      ],
    });

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: "Relatório de Alunos Reprovados",
                  bold: true,
                  size: 32,
                  font: "Helvetica",
                  color: "1E293B",
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Turma: ${selectedTurma}`,
                  bold: true,
                  size: 24,
                  font: "Helvetica",
                  color: "64748B",
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),
            table,
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const fileName = `Reprovados_${selectedTurma}_${activeTab}.docx`;

    const saveToDrive = await confirm({
      title: "Salvar no Drive",
      message: `Deseja salvar o relatório direto no Google Drive em vez de baixar?`,
      confirmText: "Salvar no Drive",
      cancelText: "Apenas Baixar",
    });

    if (saveToDrive) {
      if (!accessToken) {
        showAlert(
          "Você precisa confirmar o login do Google com permissão do Drive para salvar arquivos.",
          "warning",
        );
        return;
      }
      setReportDataToSave({ fileName, blob });
      setIsDrivePickerOpen(true);
    } else {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleUploadToDrive = async (folderId: string, folderName: string) => {
    setIsDrivePickerOpen(false);
    if (!reportDataToSave || !accessToken) return;

    try {
      setIsSyncing(true);
      const metadata = {
        name: reportDataToSave.fileName,
        parents: [folderId],
      };

      // 1. Iniciate resumable upload
      const initRes = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(metadata),
        },
      );

      if (!initRes.ok) {
        const errText = await initRes.text();
        console.error("Upload init error", errText);
        throw new Error("Erro ao iniciar upload");
      }

      const uploadUrl = initRes.headers.get("Location");
      if (!uploadUrl) throw new Error("Location header missing");

      // 2. Upload file content
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: reportDataToSave.blob,
        headers: {
          "Content-Type":
            reportDataToSave.blob.type ||
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
      });

      if (uploadRes.ok) {
        showAlert(
          `Relatório salvo na pasta "${folderName}" com sucesso!`,
          "success",
        );
      } else {
        const errText = await uploadRes.text();
        console.error("Upload file error", errText);
        showAlert(
          "Erro ao salvar no Google Drive. Verifique se o login foi recarregado.",
          "error",
        );
      }
    } catch (error) {
      console.error("Error saving to drive", error);
      showAlert("Ocorreu um erro ao comunicar com o Google Drive.", "error");
    } finally {
      setIsSyncing(false);
      setReportDataToSave(null);
    }
  };

  const copyReport = () => {
    const reprovados = currentGrades.filter(
      (g) => typeof g.grade === "number" && g.grade < 5,
    );
    if (reprovados.length === 0) {
      alert("Nenhum aluno reprovado nesta lista.");
      return;
    }

    let text = `Relatório de Alunos Reprovados - Avaliação\n`;
    text += `Turma: ${selectedTurma}\n\n`;
    reprovados.forEach((r) => {
      text += `- ${r.studentName} | Nota: ${r.grade}\n`;
    });

    navigator.clipboard.writeText(text);
    alert("Copiado para a área de transferência!");
  };

  const [subTab, setSubTab] = useState<"lancamento" | "relatorio">(
    "lancamento",
  );

  if (!selectedTurma) {
    return (
      <div className="flex flex-col h-full bg-slate-50/50">
        <div className="px-4 pt-4 shrink-0">
          <div className="flex bg-slate-200/50 p-1 rounded-xl w-fit max-w-full overflow-x-auto">
            <button
              onClick={() => setSubTab("lancamento")}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${subTab === "lancamento" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Lançamento de Notas
            </button>
            <button
              onClick={() => setSubTab("relatorio")}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${subTab === "relatorio" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Relatório Geral (Séries)
            </button>
          </div>
        </div>

        {subTab === "relatorio" ? (
          <div className="p-4 flex-1 overflow-auto">
            <BimestralReportView
              gradesData={gradesData}
              selectedBimestre={selectedBimestre}
              turmasList={turmasList || []}
              dataKeyFormat={(t, b) => `${b}_${t}_${defaultTab}`}
            />
          </div>
        ) : (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {!turmasList || turmasList.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-dashed border-slate-300">
                <BookOpen className="w-12 h-12 text-slate-400 mb-4" />
                <h2 className="text-xl font-bold text-slate-800 mb-2">
                  Nenhuma Turma Adicionada
                </h2>
              </div>
            ) : (
              turmasList.map((turma) => (
                <motion.div
                  key={turma}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 hover:shadow-md hover:-translate-y-1 transition-all cursor-pointer group"
                  onClick={() => {
                    setSelectedTurma(turma);
                    setSubTab("lancamento");
                  }}
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                      <BookOpen size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 leading-tight">
                      {turma}
                    </h3>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  const filteredGrades = currentGrades;

  return (
    <div className="flex flex-col flex-1 min-h-[70vh] print:min-h-0 print:h-auto print:block">
      <div className="bg-white shadow-sm border border-slate-200 flex flex-col overflow-hidden rounded-2xl flex-1 print:border-none print:shadow-none print:rounded-none print:overflow-visible print:block">
        <div className="p-4 md:p-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedTurma(null)}
              className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition-colors"
              title="Voltar para turmas"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-chevron-right rotate-180"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
            <h2 className="text-xl font-bold text-slate-800">
              {selectedTurma}
            </h2>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
            <button
              onClick={() => setSubTab("lancamento")}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${subTab === "lancamento" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Lançamento
            </button>
            <button
              onClick={() => setSubTab("relatorio")}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${subTab === "relatorio" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Relatório da Turma
            </button>
          </div>
        </div>

        {subTab === "relatorio" ? (
          <div className="p-4 flex-1 overflow-auto bg-slate-50">
            <BimestralReportView
              gradesData={gradesData}
              selectedBimestre={selectedBimestre}
              selectedTurma={selectedTurma}
              dataKeyFormat={(t, b) => `${b}_${t}_${defaultTab}`}
            />
          </div>
        ) : (
          <>
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col xl:flex-row gap-4 justify-between items-center">
              <div className="flex flex-col sm:flex-row gap-2 flex-1 w-full">
                <input
                  type="text"
                  placeholder="Título da Avaliação (Ex: Prova Bimestral)"
                  value={currentMeta.title}
                  onChange={(e) => handleUpdateMeta("title", e.target.value)}
                  className="w-full sm:max-w-xs px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  type="date"
                  value={currentMeta.date}
                  onChange={(e) => handleUpdateMeta("date", e.target.value)}
                  className="w-full sm:w-auto px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
                />
              </div>

              <div className="flex items-center gap-2 w-full xl:w-auto justify-end">
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
              </div>
            </div>

            <div className="flex-1 p-0 overflow-auto">
              <div className="p-4 border-b border-slate-100 bg-white flex justify-end items-center bg-slate-50">
                <button
                  onClick={syncStudentsWithDatabase}
                  disabled={isSyncing}
                  className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100 rounded-lg font-bold text-xs transition-colors shrink-0 shadow-sm"
                >
                  {isSyncing ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Users size={14} />
                  )}
                  {isSyncing ? "Sincronizando..." : "Puxar Alunos da Planilha"}
                </button>
              </div>

              {filteredGrades.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-50 border-t border-slate-200 h-full">
                  <BookOpen className="w-12 h-12 text-slate-300 mb-4" />
                  <h3 className="text-lg font-bold text-slate-700 mb-2">
                    Nenhuma nota registrada
                  </h3>
                  <p className="text-sm text-slate-500 max-w-sm">
                    Adicione os alunos manualmente ou clique em "Puxar Alunos da
                    Planilha" para importar a lista de alunos.
                  </p>
                </div>
              ) : (
                <div className="w-full min-w-[600px]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80 sticky top-0 z-10 backdrop-blur-sm">
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-12 text-center">
                          Nº
                        </th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Aluno
                        </th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-32 text-center">
                          Nota
                        </th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-20 text-center">
                          Ação
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredGrades.map((record, index) => {
                        const isReprovado =
                          typeof record.grade === "number" && record.grade < 5;
                        const isAprovado =
                          typeof record.grade === "number" && record.grade >= 5;

                        return (
                          <tr
                            key={record.id}
                            className="hover:bg-slate-50/80 transition-colors group"
                          >
                            <td className="px-6 py-3 text-sm font-medium text-slate-400 text-center">
                              {index + 1}
                            </td>
                            <td className="px-6 py-3 text-sm font-medium text-slate-700">
                              {record.studentName}
                            </td>
                            <td className="px-6 py-3 flex justify-center">
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                max="10"
                                value={record.grade}
                                onChange={(e) =>
                                  updateGrade(record.id, e.target.value)
                                }
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
                              <button
                                onClick={() => removeGrade(record.id)}
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                              >
                                <Trash2 size={18} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <DriveFolderPickerModal
        isOpen={isDrivePickerOpen}
        onClose={() => setIsDrivePickerOpen(false)}
        onSelect={handleUploadToDrive}
        accessToken={accessToken || ""}
      />
    </div>
  );
}
