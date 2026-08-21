STATUS DO PROMPT 08C.2.3: CONCLUÍDO

1. Qual componente é renderizado quando o usuário clica em "Matific" na Central de Avaliações?
O componente renderizado é o `MatificAnalysis` (importado de `src/views/MatificAnalysis.tsx`), que atua como o View Switcher oficial do fluxo de Matific.

2. Esse componente direciona para o CanonicalMatificAnalysisView por padrão? SIM ou NÃO.
SIM.

3. Como o usuário acessa o LegacyMatificAnalysisView agora?
Clicando no botão "Ver Registros Legados" do View Switcher. O layout desse switcher foi alterado de `absolute z-50` para um `inline-flex` no fluxo normal do documento, garantindo que ele sempre seja visível na interface inicial e nunca fique oculto ou cortado.

4. A seleção inicial de turmas no Canonical usa localStorage? SIM ou NÃO. Se não, o que usa?
NÃO. A interface inicial do `CanonicalMatificAnalysisView.tsx` foi completamente reescrita neste prompt para consumir os repositórios reais da nova arquitetura (`AcademicYearRepository` e `ClassGroupRepository`), permitindo selecionar o Ano Letivo e listar as turmas ativas do Cadastro Acadêmico sem depender de localStorage.

5. A função "Nova Semana" foi recriada para o modo canônico sem localStorage ou permanece só no legado?
Foi recriada para o modo canônico utilizando diretamente a API da nova arquitetura (chamando `matificService.createManualImport` que escreve no Firestore). A lógica antiga, baseada em localStorage, permanece restrita exclusivamente ao `LegacyMatificAnalysisView`.
