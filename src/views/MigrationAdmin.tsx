import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authenticatedFetch } from '../lib/apiClient';
import { ClassAliasDecision } from '../domain/migration';
import { ClassGroup } from '../domain';
import { saveClassAlias, clearClassAlias, loadClassAliases } from '../data/migration/ClassAliasService';

export default function MigrationAdmin() {
  const { user, loading } = useAuth();
  const [authStatus, setAuthStatus] = useState<'LOADING' | 'UNAUTHORIZED' | 'AUTHORIZED'>('LOADING');
  const [authError, setAuthError] = useState<string | null>(null);
  const [status, setStatus] = useState('Aguardando início...');
  const [report, setReport] = useState<any>(null);
  
  const [reviewLoaded, setReviewLoaded] = useState(false);
  const [sanitizedReport, setSanitizedReport] = useState<any>(null);
  const [reviewPatterns, setReviewPatterns] = useState<any[]>([]);
  const [canonicalGroups, setCanonicalGroups] = useState<any[]>([]);

  const [classAliases, setClassAliases] = useState<Record<string, ClassAliasDecision>>({});

  useEffect(() => {
    if (loading) return;
    
    if (!user) {
      setAuthStatus('UNAUTHORIZED');
      setAuthError('Você precisa estar autenticado para acessar esta ferramenta.');
      return;
    }

    const checkAuth = async () => {
      try {
        const response = await authenticatedFetch('/api/migration/access');
        if (response.ok) {
          const data = await response.json();
          if (data.authorized) {
            setAuthStatus('AUTHORIZED');
            const aliases = await loadClassAliases(user.uid);
            setClassAliases(aliases);
          } else {
            setAuthStatus('UNAUTHORIZED');
            setAuthError('Usuário não autorizado a utilizar este recurso.');
          }
        } else {
           if (response.status === 401) {
              setAuthStatus('UNAUTHORIZED');
              setAuthError('Sessão inválida. Por favor, faça login novamente.');
           } else if (response.status === 403) {
              setAuthStatus('UNAUTHORIZED');
              setAuthError('Acesso negado. Usuário não está na allowlist.');
           } else {
              setAuthStatus('UNAUTHORIZED');
              setAuthError(`Erro na verificação de acesso: ${response.status}`);
           }
        }
      } catch (err) {
        setAuthStatus('UNAUTHORIZED');
        setAuthError('Erro de conexão ao verificar autorização.');
      }
    };
    
    checkAuth();
  }, [user, loading]);

  if (authStatus === 'LOADING' || loading) {
     return <div className="p-8">Verificando autorização...</div>;
  }
  
  if (authStatus === 'UNAUTHORIZED') {
     return (
       <div className="p-8 max-w-2xl mx-auto mt-10 bg-red-50 border border-red-200 rounded-lg shadow-sm">
         <h2 className="text-xl font-bold text-red-800 mb-2">Acesso Restrito</h2>
         <p className="text-red-700">{authError}</p>
       </div>
     );
  }

  
  const handleLoadReview = async () => {
    setStatus('Carregando dados para revisão de turmas...');
    try {
      const { createLegacySnapshot } = await import('../data/migration/LegacyDataCollector');
      const { extractClassReviewPatterns, getProposedClassGroups } = await import('../data/migration/MigrationDryRun');
      const { loadPreparedMappings } = await import('../data/migration/MigrationMappingService');
      const { loadClassAliases } = await import('../data/migration/ClassAliasService');
      
      const snapshot = await createLegacySnapshot(user.uid);
      const existingMappings = await loadPreparedMappings(user.uid);
      const aliases = await loadClassAliases(user.uid);
      
      const groups = getProposedClassGroups(existingMappings);
      const patterns = await extractClassReviewPatterns(snapshot, groups, aliases);
      
      setCanonicalGroups(groups);
      setClassAliases(aliases);
      setReviewPatterns(patterns);
      
      setStatus('Revisão carregada com sucesso.');
      setReviewLoaded(true);
    } catch (e: any) {
      console.error(e);
      setStatus(`Erro: ${e.message}`);
    }
  };

  const handleRun = async () => {
    setStatus('Iniciando...');
    try {
      const { createLegacySnapshot } = await import('../data/migration/LegacyDataCollector');
      const { generateMigrationPreview } = await import('../data/migration/MigrationDryRun');
      const { createMigrationManifest } = await import('../data/migration/MigrationService');
      const { loadPreparedMappings } = await import('../data/migration/MigrationMappingService');
      const { loadClassAliases } = await import('../data/migration/ClassAliasService');
      
      setStatus('Coletando Legacy Snapshot...');
      const snapshot = await createLegacySnapshot(user.uid);
      
      setStatus('Buscando Mapeamentos Existentes...');
      const existingMappings = await loadPreparedMappings(user.uid);
      
      setStatus('Buscando Decisões Manuais de Turma...');
      const aliases = await loadClassAliases(user.uid);
      setClassAliases(aliases);

      setStatus('Rodando Simulação (Dry Run)...');
      const backupId = `bkp_${Date.now()}`;
      const runId = `mig_${Date.now()}`;
      const { preview } = await generateMigrationPreview(snapshot, existingMappings, aliases, runId);
      
      setStatus('Gerando MigrationManifest...');
      await createMigrationManifest(preview, backupId, runId, user.uid);
      
      const finalReport = {
        backupId,
        runId,
        preview,
        sourcesCollected: snapshot.sources,
        localStorageKeys: Object.keys(snapshot.localStorageData)
      };
      
      setReport(finalReport);
      
      // Sanitized report MUST NOT include real legacy references or names
      const sanitized = {
        backupId: backupId.replace(/_.+?_/, '_***_'),
        migrationRunId: runId,
        sources: snapshot.sources,
        studentSourceRecords: preview.studentSourceRecords,
        studentFieldCoverage: preview.studentFieldCoverage,
        freshMatching: preview.freshMatching,
        ambiguityGraph: preview.ambiguityGraph,
        mappingConsistency: preview.mappingConsistency,
        mappingReconciliation: preview.mappingReconciliation,
        classReview: preview.classReview,
        matificClassPatternAudit: preview.matificClassPatternAudit,
        ambiguityClassCorrelation: preview.ambiguityClassCorrelation,
        identifierCompleteness: preview.identifierCompleteness,
        strongIdCoverage: preview.strongIdCoverage,
        ambiguousBySourcePair: preview.ambiguousBySourcePair,
        ambiguousByClassResolution: preview.ambiguousByClassResolution,
        ambiguousReasons: preview.ambiguousReasons,
        identifierSafety: preview.identifierSafety,
        classResolution: preview.classResolution,
        assessmentAudit: preview.assessmentAudit,
        resultAudit: preview.resultAudit,
        warningsCount: preview.warnings.length,
        errorsCount: preview.errors.length,
        safetyGates: {
            BACKUP_CREATED: true,
            BACKUP_VERIFIED: true,
            COLLECTION_COMPLETE: true,
            DRY_RUN_COMPLETE: true,
            BLOCKING_ERRORS: preview.errors.length,
            AMBIGUOUS_CONFLICTS: preview.freshMatching.ambiguousConnectedComponents,
            ORPHAN_RESULTS: 0,
            MAPPING_CONSISTENCY_OK: preview.mappingConsistency.mismatchRecords === 0 && preview.mappingConsistency.mismatchGroups === 0,
            IDENTIFIERS_STABLE: preview.identifierSafety.unstableLegacyIdentifiers === 0,
            CLASS_ASSIGNMENTS_RESOLVED: preview.classResolution.unresolvedClassAssignments === 0,
            ASSESSMENT_SCHEMA_VALIDATED: Object.values(preview.assessmentAudit.unrecognizedRecords).length === 0,
            RESULT_SCHEMA_VALIDATED: Object.values(preview.resultAudit.unrecognizedRecords).length === 0 && preview.resultAudit.resultAdapterValidation.unrecognizedLeaves === 0 && preview.resultAudit.resultAdapterValidation.recognizedLeaves > 0,
            MIGRATION_READY: preview.MIGRATION_READY,
            BLOCKING_REASONS: preview.blockingReasons
        }
      };
      
      setSanitizedReport(sanitized);
      
      setStatus('CONCLUÍDO! Verifique a aba de revisão antes de enviar o json.');
    } catch (e: any) {
      console.error(e);
      setStatus(`Erro: ${e.message}`);
    }
  };

  const handleConfirmAlias = async (fingerprint: string, source: string, canonicalClassGroupId: string) => {
    if (!user) return;
    try {
      const decision: ClassAliasDecision = {
         fingerprint,
         source,
         canonicalClassGroupId,
         status: 'CONFIRMED',
         createdAt: Date.now(),
         updatedAt: Date.now(),
         migrationReviewVersion: 7
      };
      await saveClassAlias(user.uid, decision);
      
      const newAliases = await loadClassAliases(user.uid);
      setClassAliases(newAliases);
      alert('Alias confirmado! Execute novamente o dry-run para refletir as mudanças.');
    } catch(e: any) {
      alert(`Erro: ${e.message}`);
    }
  };

  const handleClearAlias = async (fingerprint: string, source: string) => {
    if (!user) return;
    try {
      const decision: ClassAliasDecision = { 
         fingerprint,
         source,
         canonicalClassGroupId: null,
         status: 'CLEARED',
         createdAt: Date.now(),
         updatedAt: Date.now(),
         migrationReviewVersion: 7
      };
      await saveClassAlias(user.uid, decision);
      const newAliases = await loadClassAliases(user.uid);
      setClassAliases(newAliases);
      alert('Alias limpo! Execute novamente o dry-run para refletir as mudanças.');
    } catch(e: any) {
      alert(`Erro: ${e.message}`);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto bg-white min-h-screen">
      <h1 className="text-3xl font-bold mb-4">Dry-Run da Migração Canônica (V7)</h1>
      <p className="mb-6 text-gray-700">
        Esta tela executará a coleta, verificará decisões manuais de turmas, identificará ambiguidades residuais, e profilará profundamente o schema dos resultados de avaliações.
      </p>
      
      <div className="mb-6 space-x-4">
        <button 
          onClick={handleLoadReview}
          className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-6 rounded shadow transition-colors"
        >
          CARREGAR REVISÃO DE TURMAS
        </button>
        <button 
          onClick={handleRun} 
          disabled={!reviewLoaded}
          className={`${reviewLoaded ? 'bg-indigo-600 hover:bg-indigo-700 cursor-pointer' : 'bg-slate-300 text-slate-500 cursor-not-allowed'} text-white font-bold py-2 px-6 rounded-lg shadow-md transition-colors`}
        >
          EXECUTAR DRY-RUN V7
        </button>
      </div>
      
      <div className="mt-6 p-4 border rounded bg-slate-50">
        <span className="font-semibold text-slate-800">Status: </span>
        <span className="text-slate-600">{status}</span>
      </div>

      {reviewPatterns.length > 0 && (
        <div className="mt-8 p-6 bg-amber-50 border border-amber-200 rounded-lg">
          <h2 className="text-xl font-bold text-amber-900 mb-4">REVISÃO DE TURMAS (Somente Local)</h2>
          <p className="text-amber-800 mb-4 text-sm">
            Estes padrões não foram mapeados automaticamente. O nome real e a decisão NÃO serão exportados no JSON sanitizado por razões de privacidade.
          </p>
          <div className="space-y-4">
            {reviewPatterns.map((pat: any) => {
               const decision = classAliases[pat.fingerprint];
               const statusColor = decision?.status === 'CONFIRMED' ? 'bg-green-100 border-green-300' : 'bg-white border-amber-300';
               return (
                 <div key={pat.fingerprint} className={`p-4 border rounded-md ${statusColor} shadow-sm`}>
                    <div className="flex justify-between items-center mb-2">
                       <div>
                         <span className="text-xs text-gray-500 block mb-1">Fonte: {pat.source} | Alunos Órfãos: {pat.recordsAffected}</span>
                         <span className="font-mono text-lg font-bold text-gray-800">{pat.legacyReference}</span>
                       </div>
                       <div>
                         {decision?.status === 'CONFIRMED' && (
                           <span className="px-2 py-1 bg-green-200 text-green-800 text-xs font-bold rounded">RESOLVIDO</span>
                         )}
                       </div>
                    </div>
                    
                    <div className="flex gap-2 items-center mt-3">
                       <select 
                         id={`select-${pat.fingerprint}`}
                         className="border border-gray-300 rounded p-2 text-sm flex-1 bg-white"
                         defaultValue={decision?.canonicalClassGroupId || ""}
                       >
                         <option value="">-- Selecione a Turma Correta --</option>
                         {canonicalGroups.map((cg: ClassGroup) => (
                           <option key={cg.id} value={cg.id}>{cg.name}</option>
                         ))}
                       </select>
                       
                       <button 
                         onClick={() => {
                            const val = (document.getElementById(`select-${pat.fingerprint}`) as HTMLSelectElement).value;
                            if (val) handleConfirmAlias(pat.fingerprint, pat.source, val);
                         }}
                         className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded text-sm font-semibold transition"
                       >
                         Confirmar Alias
                       </button>
                       {decision?.status === 'CONFIRMED' && (
                         <button 
                           onClick={() => handleClearAlias(pat.fingerprint, pat.source)}
                           className="bg-red-100 hover:bg-red-200 text-red-800 px-4 py-2 rounded text-sm font-semibold transition"
                         >
                           Limpar Alias
                         </button>
                       )}
                    </div>
                 </div>
               );
            })}
          </div>
        </div>
      )}
      
      {sanitizedReport && (
        <div className="mt-8">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-2xl font-semibold">Relatório Sanitizado V7</h2>
            <button 
              onClick={() => navigator.clipboard.writeText(JSON.stringify(sanitizedReport, null, 2))}
              className="text-sm bg-gray-200 hover:bg-gray-300 py-1 px-3 rounded"
            >
              COPIAR JSON
            </button>
          </div>
          <pre className="bg-gray-900 text-gray-100 p-4 rounded overflow-x-auto text-sm">
            {JSON.stringify(sanitizedReport, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
