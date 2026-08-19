import React, { useState, useRef } from 'react';
import { AcademicYear, ClassGroup } from '../domain';
import { AcademicImporterService } from '../services/academic/AcademicImporterService';
import { StudentRepository, EnrollmentRepository } from '../data/repositories';
import { ParseResult, SheetOption } from '../services/academic/AcademicImporterTypes';
import { X, Upload, FileText, AlertCircle, CheckCircle2, FileSpreadsheet } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface AcademicImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  academicYear: AcademicYear;
  classGroup: ClassGroup;
  onSuccess: () => void;
}

export default function AcademicImportModal({ isOpen, onClose, academicYear, classGroup, onSuccess }: AcademicImportModalProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sheets, setSheets] = useState<SheetOption[] | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    
    setFile(selected);
    setError(null);
    setParseResult(null);
    setSheets(null);
    await analyze(selected);
  };

  const analyze = async (selectedFile: File, sheetName?: string) => {
    setIsAnalyzing(true);
    try {
      if (!user?.uid) throw new Error("Usuário não autenticado");
      
      const studentRepo = new StudentRepository();
      const enrollmentRepo = new EnrollmentRepository();
      const importer = new AcademicImporterService(studentRepo, enrollmentRepo);
      
      const response = await importer.analyzeFile(user.uid, selectedFile, academicYear, classGroup, sheetName);
      
      if (response.errors.length > 0) {
        setError(response.errors.join('\n'));
      } else if (response.sheets && response.sheets.length > 1) {
        setSheets(response.sheets);
      } else if (response.result) {
        setParseResult(response.result);
      }
    } catch (err: any) {
      setError(err.message || "Erro desconhecido ao processar o arquivo.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSheetSelect = (sheetName: string) => {
    if (!file) return;
    setSheets(null);
    analyze(file, sheetName);
  };

  const handleCommit = async () => {
    if (!parseResult || !user?.uid) return;
    
    setIsCommitting(true);
    setError(null);
    
    try {
      const studentRepo = new StudentRepository();
      const enrollmentRepo = new EnrollmentRepository();
      const importer = new AcademicImporterService(studentRepo, enrollmentRepo);
      
      await importer.commitImport(user.uid, academicYear, classGroup, parseResult.candidates);
      onSuccess();
    } catch (err: any) {
      setError("Importação interrompida. Parte dos registros pode ter sido salva. Reprocesse o mesmo arquivo para concluir com segurança. " + (err.message || ''));
      setIsCommitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b flex items-center justify-between bg-gray-50/50">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Importar Alunos</h2>
            <p className="text-sm text-gray-500">Turma {classGroup.name} • {academicYear.year}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {!file && (
            <div 
              className="border-2 border-dashed border-gray-200 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <Upload className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-sm font-medium text-gray-900 mb-1">Clique para selecionar o arquivo</h3>
              <p className="text-xs text-gray-500 max-w-xs mx-auto">Suporta .csv, .xls e .xlsx da plataforma SED.</p>
            </div>
          )}

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            accept=".csv, .xls, .xlsx" 
            className="hidden" 
          />

          {isAnalyzing && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-sm text-gray-600">Analisando registros...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3 text-red-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <div className="text-sm whitespace-pre-wrap">{error}</div>
            </div>
          )}

          {sheets && sheets.length > 1 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-900">Múltiplas abas compatíveis encontradas. Qual deseja importar?</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {sheets.map(s => (
                  <button
                    key={s.name}
                    onClick={() => handleSheetSelect(s.name)}
                    className="border p-4 rounded-lg flex items-center gap-3 hover:bg-blue-50 hover:border-blue-200 transition-colors text-left"
                  >
                    <FileSpreadsheet className="w-5 h-5 text-gray-400" />
                    <div>
                      <div className="font-medium text-gray-900">{s.name}</div>
                      <div className="text-xs text-gray-500">{s.data.length} linhas</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {parseResult && (
            <div className="space-y-6">
              
              {parseResult.warnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 text-sm">
                  <div className="font-medium mb-1">Avisos do arquivo:</div>
                  <ul className="list-disc pl-5 space-y-1">
                    {parseResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                  <p className="mt-2 text-xs">Algumas funcionalidades podem estar limitadas, mas você pode continuar.</p>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-4 border text-center">
                  <div className="text-2xl font-bold text-gray-900">{parseResult.stats.rowsRead}</div>
                  <div className="text-xs text-gray-500 uppercase font-medium mt-1">Registros Lidos</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-100 text-center">
                  <div className="text-2xl font-bold text-blue-700">{parseResult.stats.uniqueStudents}</div>
                  <div className="text-xs text-blue-600 uppercase font-medium mt-1">Alunos Únicos</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 border border-green-100 text-center">
                  <div className="text-2xl font-bold text-green-700">{parseResult.stats.activeStudents}</div>
                  <div className="text-xs text-green-600 uppercase font-medium mt-1">Ativos</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 border text-center">
                  <div className="text-2xl font-bold text-gray-600">{parseResult.stats.nonActiveStudents}</div>
                  <div className="text-xs text-gray-500 uppercase font-medium mt-1">Não Ativos</div>
                </div>
                <div className="bg-amber-50 rounded-lg p-4 border border-amber-100 text-center">
                  <div className="text-2xl font-bold text-amber-700">{parseResult.stats.historicalDuplicateRows}</div>
                  <div className="text-xs text-amber-600 uppercase font-medium mt-1">Histórico Consolidado</div>
                </div>
                <div className="bg-red-50 rounded-lg p-4 border border-red-100 text-center">
                  <div className="text-2xl font-bold text-red-700">{parseResult.stats.reviewRequiredRows}</div>
                  <div className="text-xs text-red-600 uppercase font-medium mt-1">Para Revisão</div>
                </div>
              </div>

              <div className="bg-white border rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b flex justify-between items-center">
                  <h4 className="text-sm font-medium text-gray-900">Previsão da Base de Dados</h4>
                </div>
                <div className="divide-y text-sm">
                   <div className="flex justify-between px-4 py-3">
                     <span className="text-gray-600">Novos alunos a criar</span>
                     <span className="font-medium text-gray-900">{parseResult.stats.newStudents}</span>
                   </div>
                   <div className="flex justify-between px-4 py-3">
                     <span className="text-gray-600">Alunos existentes encontrados</span>
                     <span className="font-medium text-gray-900">{parseResult.stats.existingStudents}</span>
                   </div>
                   <div className="flex justify-between px-4 py-3">
                     <span className="text-gray-600">Matrículas a atualizar</span>
                     <span className="font-medium text-gray-900">{parseResult.stats.updatedEnrollments}</span>
                   </div>
                   <div className="flex justify-between px-4 py-3">
                     <span className="text-gray-600">Alterações de turma</span>
                     <span className="font-medium text-gray-900">{parseResult.stats.classChanges}</span>
                   </div>
                   <div className="flex justify-between px-4 py-3">
                     <span className="text-gray-600">Sem modificações</span>
                     <span className="font-medium text-gray-900">{parseResult.stats.ignoredDuplicates}</span>
                   </div>
                   {parseResult.stats.notPresentInNewFile > 0 && (
                     <div className="flex justify-between px-4 py-3 bg-amber-50/50">
                       <span className="text-amber-700">Ativos ausentes no arquivo (não serão apagados)</span>
                       <span className="font-medium text-amber-900">{parseResult.stats.notPresentInNewFile}</span>
                     </div>
                   )}
                </div>
              </div>
              
              {parseResult.stats.reviewRequiredRows > 0 && (
                 <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start gap-3 text-red-800">
                       <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                       <div>
                         <h4 className="font-medium mb-1">Revisão Necessária ({parseResult.stats.reviewRequiredRows} registros)</h4>
                         <p className="text-sm mb-2 text-red-700">O arquivo contém conflitos que impedem a importação segura. Corrija o arquivo no Excel e tente novamente.</p>
                         <ul className="text-xs list-disc pl-4 space-y-1 text-red-700">
                           {parseResult.candidates.filter(c => c.action === 'REVIEW_REQUIRED').slice(0, 5).map((c, idx) => (
                              <li key={idx}>
                                {c.parsed.name || 'Sem nome'} ({c.parsed.ra || 'Sem RA'}) - 
                                {c.conflictReason === 'MISSING_STRONG_IDENTIFIER' && ' RA Ausente'}
                                {c.conflictReason === 'DUPLICATE_ACTIVE_CONFLICT' && ' Múltiplos ativos na mesma tabela'}
                                {c.conflictReason === 'IDENTITY_NAME_CONFLICT' && ' Nome muito diferente do RA existente'}
                                {c.conflictReason === 'IDENTITY_CONFLICT' && ' Dígito do RA incompatível'}
                                {c.conflictReason === 'STATUS_HISTORY_CONFLICT' && ' Histórico de status incompatível'}
                                {c.conflictReason === 'UNKNOWN_STATUS' && ' Status desconhecido'}
                              </li>
                           ))}
                           {parseResult.stats.reviewRequiredRows > 5 && (
                             <li>... e mais {parseResult.stats.reviewRequiredRows - 5}</li>
                           )}
                         </ul>
                       </div>
                    </div>
                 </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
          <button 
            onClick={onClose}
            disabled={isCommitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          
          <button 
            onClick={handleCommit}
            disabled={!parseResult || isCommitting || parseResult.stats.reviewRequiredRows > 0}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isCommitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Salvando...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Confirmar Importação
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
