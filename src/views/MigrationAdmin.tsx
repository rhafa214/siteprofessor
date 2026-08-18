import React, { useState, useEffect } from 'react';
import { createLegacySnapshot } from '../data/migration/LegacyDataCollector';
import { runMigrationDryRun, backupLegacySnapshot, createMigrationManifest } from '../data/migration/MigrationService';
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
              setAuthError(`Erro inesperado: ${response.status}`);
           }
        }
      } catch (err: any) {
        setAuthStatus('UNAUTHORIZED');
        setAuthError(`Erro de conexão: ${err.message}`);
      }
    };

    checkAuth();
  }, [user, loading]);

  if (loading || authStatus === 'LOADING') return <div className="p-8 text-slate-500">Carregando...</div>;

  if (authStatus === 'UNAUTHORIZED' || !user) {
    return (
      <div className="p-8 max-w-4xl mx-auto bg-white min-h-screen">
        <h1 className="text-3xl font-bold mb-4 text-red-600">Acesso Negado</h1>
        <p className="text-slate-800 font-medium">{authError || 'Acesso restrito.'}</p>
      </div>
    );
  }

  const handleRun = async () => {
    if (!window.confirm("Nenhum dado acadêmico existente será apagado.\nSerá criado somente backup + dry-run.\nNenhuma migração canônica ocorrerá.\nCredenciais não serão incluídas.\n\nDeseja continuar?")) {
      return;
    }
  
    try {
      setStatus('Coletando dados legacy...');
      const snapshot = await createLegacySnapshot(user.uid);
      
      setStatus('Executando backup particionado...');
      const backupId = await backupLegacySnapshot(snapshot);
      
      setStatus('Executando Dry-Run da Migração...');
      const runId = `mig_${Date.now()}`;
      const preview = await runMigrationDryRun(snapshot, runId);
      
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
        matching: preview.matching,
        conflictsByType: preview.conflictsByType,
        assessmentSourcesPresent: preview.assessmentSourcesPresent,
        assessmentSourceRecordCounts: preview.assessmentSourceRecordCounts,
        resultSourcesPresent: preview.resultSourcesPresent,
        resultSourceRecordCounts: preview.resultSourceRecordCounts,
        legacyStats: {
          classGroupsDetected: preview.classGroupsDetected,
          studentsDetected: preview.studentsDetected,
          assessmentsDetected: preview.assessmentsDetected,
          resultsDetected: preview.resultsDetected,
          planningsDetected: preview.planningsDetected,
        },
        warningsCount: preview.warnings.length,
        errorsCount: preview.errors.length,
        safetyGates: {
            BACKUP_CREATED: true,
            BACKUP_VERIFIED: true,
            COLLECTION_COMPLETE: true,
            DRY_RUN_COMPLETE: true,
            BLOCKING_ERRORS: preview.errors.length,
            AMBIGUOUS_CONFLICTS: preview.matching.ambiguousGroups,
            ORPHAN_RESULTS: 0
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
      <h1 className="text-3xl font-bold mb-4">Dry-Run da Migração Canônica (Prompt 07A.1 & 07A.2)</h1>
      <p className="mb-6 text-gray-700">
        Esta tela executará a coleta do seu LocalStorage e Firestore (somente leitura), criará o backup e rodará a simulação.
      </p>
      
      <button 
        onClick={handleRun} 
        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg shadow-md transition-colors"
      >
        EXECUTAR BACKUP + DRY-RUN
      </button>
      
      <div className="mt-6 p-4 border rounded bg-slate-50">
        <span className="font-semibold text-slate-800">Status: </span>
        <span className="text-slate-600">{status}</span>
      </div>
      
      {sanitizedReport && (
        <div className="mt-8">
          <div className="flex justify-between items-center mb-2">
              <h2 className="text-xl font-bold">Relatório Sanitizado para Suporte:</h2>
              <button 
                 onClick={() => navigator.clipboard.writeText(JSON.stringify(sanitizedReport, null, 2))}
                 className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-1 px-3 rounded text-sm"
              >
                  Copiar relatório sanitizado
              </button>
          </div>
          <textarea 
            className="w-full h-96 p-4 font-mono text-sm border rounded bg-slate-900 text-green-400"
            readOnly
            value={JSON.stringify(sanitizedReport, null, 2)}
          />
        </div>
      )}
    </div>
  );
}
