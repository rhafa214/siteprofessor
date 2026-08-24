import fs from 'fs';

let content = fs.readFileSync('src/views/CanonicalAssessmentView.tsx', 'utf8');

content = content.replace(
  'import { Loader2, Save, Download, Copy, History } from "lucide-react";',
  'import { Loader2, Save, Download, Copy, History, Upload } from "lucide-react";\nimport DriveFolderPickerModal from "../components/DriveFolderPickerModal";'
);

content = content.replace(
  '  const { user } = useAuth();',
  '  const { user, accessToken } = useAuth();\n  const [isDrivePickerOpen, setIsDrivePickerOpen] = useState(false);\n  const [reportBlobData, setReportBlobData] = useState<{blob: Blob, fileName: string} | null>(null);'
);

const generateReportFnRegex = /  const copyReport = \(\) => \{/;
const generateReportFnCode = `
  const handleUploadToDrive = async (folderId: string) => {
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

  const copyReport = () => {`;
content = content.replace(generateReportFnRegex, generateReportFnCode);

const generateReportEndRegex = /    document\.body\.removeChild\(a\);\n    URL\.revokeObjectURL\(url\);\n  \};/;
const generateReportEndCode = `    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Preparar para o Drive se o usuário clicar no botão do Drive
    setReportBlobData({ blob, fileName: "Reprovados_" + category + "_" + (term?.termNumber || 1) + "Bim.docx" });
  };`;
content = content.replace(generateReportEndRegex, generateReportEndCode);

const buttonsRegex = /<Download size=\{16\} \/> Reprovados\n          <\/button>/;
const buttonsCode = `<Download size={16} /> Reprovados
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
          )}`;
content = content.replace(buttonsRegex, buttonsCode);

const modalCode = `      <DriveFolderPickerModal
        isOpen={isDrivePickerOpen}
        onClose={() => setIsDrivePickerOpen(false)}
        onSelect={handleUploadToDrive}
      />
    </div>
  );
}
`;
content = content.replace(/    <\/div>\n  \);\n\}\n*$/, modalCode);

fs.writeFileSync('src/views/CanonicalAssessmentView.tsx', content);
