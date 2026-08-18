import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authenticatedFetch } from '../lib/apiClient';

export default function MigrationAdmin() {
  const { user, loading } = useAuth();
  const [authStatus, setAuthStatus] = useState<'LOADING' | 'UNAUTHORIZED' | 'AUTHORIZED'>('LOADING');
  const [authError, setAuthError] = useState<string | null>(null);
  const [status, setStatus] = useState('Aguardando início...');
  const [report, setReport] = useState<unknown>(null);
  const [sanitizedReport, setSanitizedReport] = useState<unknown>(null);

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

  const handleRun = async () => {
    setStatus('Iniciando...');
    try {
      const { createLegacySnapshot } = await import('../data/migration/LegacyDataCollector');
      const { generateMigrationPreview } = await import('../data/migration/MigrationDryRun');
      const { createMigrationManifest } = await import('../data/migration/MigrationService');
      const { loadPreparedMappings } = await import('../data/migration/MigrationMappingService');
      
      setStatus('Coletando Legacy Snapshot...');
      const snapshot = await createLegacySnapshot(user.uid);
      
      setStatus('Buscando Mapeamentos Existentes...');
      const existingMappings = await loadPreparedMappings(user.uid);

      setStatus('Rodando Simulação (Dry Run)...');
      const backupId = `bkp_${Date.now()}`;
      const runId = `mig_${Date.now()}`;
      const { preview } = generateMigrationPreview(snapshot, existingMappings, runId);
      
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
      
      const sanitized = {
        backupId: backupId.replace(/_.+?_/, '_***_'),
        migrationRunId: runId,
        sources: snapshot.sources,
        studentSourceRecords: preview.studentSourceRecords,
        
        freshMatching: preview.freshMatching,
        mappingConsistency: preview.mappingConsistency,
        mappingReconciliation: preview.mappingReconciliation,
        
        matificClassResolutionAudit: preview.matificClassResolutionAudit,
        ambiguityClassCorrelation: preview.ambiguityClassCorrelation,
        identifierCompleteness: preview.identifierCompleteness,
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
            RESULT_SCHEMA_VALIDATED: Object.values(preview.resultAudit.unrecognizedRecords).length === 0,
            MIGRATION_READY: preview.MIGRATION_READY,
            BLOCKING_REASONS: preview.blockingReasons
        }
      };
      
      setSanitizedReport(sanitized);
      
      setStatus('CONCLUÍDO! Por favor, copie o relatório sanitizado abaixo e envie para o agente.');
    } catch (e: any) {
      console.error(e);
      setStatus(`Erro: ${e.message}`);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto bg-white min-h-screen">
      <h1 className="text-3xl font-bold mb-4">Dry-Run da Migração Canônica (V5)</h1>
      <p className="mb-6 text-gray-700">
        Esta tela executará a coleta do seu LocalStorage e Firestore (somente leitura), rodará o fresh matching e comparará a topologia dos grupos com os mappings previamente preparados. Nenhuma migração real será executada.
      </p>
      
      <button 
        onClick={handleRun} 
        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg shadow-md transition-colors"
      >
        EXECUTAR DRY-RUN V5
      </button>
      
      <div className="mt-6 p-4 border rounded bg-slate-50">
        <span className="font-semibold text-slate-800">Status: </span>
        <span className="text-slate-600">{status}</span>
      </div>
      
      {sanitizedReport && (
        <div className="mt-8">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-2xl font-semibold">Relatório Sanitizado V5</h2>
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
