     1	import React, { useState, useRef } from "react";
     2	import Papa from "papaparse";
     3	import { useLocalStorage } from "../hooks/useLocalStorage";
     4	import { authenticatedFetch } from "../lib/apiClient";
     5	import { getCurrentBimestre } from "../lib/constants";
     6	import { dbAulas, dbAEs, Aula } from "../data/guiaPedagogico";
     7	import { bnccHabilidades } from "../data/bnccHabilidades";
     8	import {
     9	  BookOpen,
    10	  PlusCircle,
    11	  CheckCircle2,
    12	  Search,
    13	  ChevronLeft,
    14	  Upload,
    15	  Settings,
    16	} from "lucide-react";
    17	
    18	export default function AddonSidebar() {
    19	  const [selectedAno, setSelectedAno] = useState<number | null>(null);
    20	  const [bimestre, setBimestre] = useState<number>(getCurrentBimestre());
    21	  const [searchTerm, setSearchTerm] = useState("");
    22	  const [insertedIds, setInsertedIds] = useState<Set<string>>(new Set());
    23	  const [activeTab, setActiveTab] = useState<"aulas" | "aes" | "settings">(
    24	    "aulas",
    25	  );
    26	  const [customAulas, setCustomAulas] = useLocalStorage<Aula[]>(
    27	    "customAulasData",
    28	    [],
    29	  );
    30	  
    31	  const [isExtractingPDF, setIsExtractingPDF] = useState(false);
    32	
    33	  const fileInputRef = useRef<HTMLInputElement>(null);
    34	
    35	  const handleFileUpload = async (
    36	    event: React.ChangeEvent<HTMLInputElement>,
    37	  ) => {
    38	    const file = event.target.files?.[0];
    39	    if (!file) return;
    40	
    41	    if (file.name.endsWith(".pdf")) {
    42	      setIsExtractingPDF(true);
    43	      try {
    44	        const formData = new FormData();
    45	        formData.append("file", file);
    46	
    47	        const res = await authenticatedFetch("/api/parse-addon-curriculum", {
    48	          method: "POST",
    49	          body: formData,
    50	        });
    51	
    52	        if (!res.ok) {
    53	          let errMsg = "Falha ao processar o PDF.";
    54	          try {
    55	            const errData = await res.json();
    56	            errMsg = errData.error || errMsg;
    57	          } catch (e) {}
    58	          throw new Error(errMsg);
    59	        }
    60	
    61	        const parsed = await res.json();
    62	        if (Array.isArray(parsed) && parsed.length > 0) {
    63	          setCustomAulas((prev) => [...prev, ...parsed]);
    64	          alert(`Escopo PDF importado com sucesso! ${parsed.length} aulas extraídas.`);
    65	        } else {
    66	          alert(`O PDF foi processado, mas o formato não continha aulas válidas.`);
    67	        }
    68	      } catch (err: any) {
    69	        console.error(err);
    70	        alert("Erro no processamento do PDF: " + (err.message || "Erro desconhecido"));
    71	      } finally {
    72	        setIsExtractingPDF(false);
    73	      }
    74	    } else if (file.name.endsWith(".json")) {
    75	      const reader = new FileReader();
    76	      reader.onload = (e) => {
    77	        try {
    78	          const json = JSON.parse(e.target?.result as string);
    79	          if (Array.isArray(json)) {
    80	            setCustomAulas(json);
    81	            alert("Escopo importado com sucesso (JSON)!");
    82	          }
    83	        } catch (err) {
    84	          alert("Erro ao ler JSON: verifique o formato do arquivo.");
    85	        }
    86	      };
    87	      reader.readAsText(file);
    88	    } else if (file.name.endsWith(".csv")) {
    89	      Papa.parse(file, {
    90	        header: true,
    91	        skipEmptyLines: true,
    92	        complete: (results) => {
    93	          const parsed = results.data.map((row: any) => ({
    94	            ano: Number(row.ano),
    95	            bimestre: Number(row.bimestre),
    96	            numero: Number(row.numero),
    97	            titulo: row.titulo || "",
    98	            conteudo: row.conteudo || "",
    99	            objetivos: row.objetivos || "",
   100	            habilidades: row.habilidades || "",
   101	            aprendizagemEssencial: row.aprendizagemEssencial || "",
   102	          }));
   103	          setCustomAulas(parsed);
   104	          alert("Escopo importado com sucesso (CSV)!");
   105	        },
   106	        error: (error) => {
   107	          alert("Erro ao ler CSV: " + error.message);
   108	        },
   109	      });
   110	    } else {
   111	      alert("Formato não suportado. Use .csv ou .json");
   112	    }
   113	  };
   114	
   115	  const formatAulasList = (numbers: number[]) => {
   116	    if (numbers.length === 0) return "";
   117	    let res = [];
   118	    let i = 0;
   119	    while (i < numbers.length) {
   120	      let start = numbers[i];
   121	      let end = start;
   122	      while (i + 1 < numbers.length && numbers[i + 1] === end + 1) {
   123	        end = numbers[i + 1];
   124	        i++;
   125	      }
   126	      if (start === end) res.push(`${start}`);
   127	      else if (end === start + 1) res.push(`${start}, ${end}`);
   128	      else res.push(`${start} a ${end}`);
   129	      i++;
   130	    }
   131	    return res.join(", ");
   132	  };
   133	
   134	  const getDetalheAprendizagem = (
   135	    ano: number,
   136	    bimestre: number,
   137	    codigo: string,
   138	  ) => {
   139	    if (!codigo || codigo === "-") return codigo;
   140	    const codigos = codigo.split(",").map((c) => c.trim());
   141	    const detalhes = codigos.map((c) => {
   142	      const aeInfo = dbAEs.find(
   143	        (ae) => ae.ano === ano && ae.bimestre === bimestre && ae.id === c,
   144	      );
   145	      return aeInfo ? `${c} - ${aeInfo.titulo}` : c;
   146	    });
   147	    return detalhes.join("\n");
   148	  };
   149	
   150	  // Filter aulas
   151	  const constAllAulas = [...dbAulas, ...customAulas];
   152	  const aulas = constAllAulas.filter((aula) => {
   153	    if (aula.ano !== selectedAno || aula.bimestre !== bimestre) return false;
   154	    const title = String(aula.titulo || aula.conteudo || "").toLowerCase();
   155	    const obj = String(aula.objetivos || "").toLowerCase();
   156	    const num = String(aula.numero || "").toLowerCase();
   157	    const term = searchTerm.toLowerCase();
   158	    return title.includes(term) || obj.includes(term) || num.includes(term);
   159	  });
   160	
   161	  const aes = dbAEs.filter((ae) => {
   162	    if (ae.ano !== selectedAno || ae.bimestre !== bimestre) return false;
   163	    const title = String(ae.titulo || "").toLowerCase();
   164	    const id = String(ae.id || "").toLowerCase();
   165	    const term = searchTerm.toLowerCase();
   166	    return title.includes(term) || id.includes(term);
   167	  });
   168	
   169	  const handleInsert = (aula: any, id: string) => {
   170	    // Construct the text to insert
   171	    const title = aula.titulo || aula.conteudo || "";
   172	    const aprendizagem = getDetalheAprendizagem(
   173	      aula.ano,
   174	      aula.bimestre,
   175	      aula.aprendizagemEssencial || "",
   176	    );
   177	    const habilidades = Array.isArray(aula.habilidades)
   178	      ? aula.habilidades.join(", ")
   179	      : aula.habilidades || "";
   180	    const objetivos = aula.objetivos || "";
   181	
   182	    let textToInsert = `Aula ${aula.numero}: ${title}\n`;
   183	    if (aprendizagem)
   184	      textToInsert += `Aprendizagem Essencial: ${aprendizagem}\n`;
   185	    if (habilidades) textToInsert += `Habilidades: ${habilidades}\n`;
   186	    if (objetivos) textToInsert += `Objetivos: ${objetivos}\n`;
   187	    textToInsert += `\n`;
   188	
   189	    // Send generic postMessage up to the parent iframe (Apps Script)
   190	    window.parent.postMessage(
   191	      {
   192	        type: "INSERT_TEXT",
   193	        text: textToInsert,
   194	      },
   195	      "*",
   196	    );
   197	
   198	    // mark as inserted visually
   199	    setInsertedIds((prev) => new Set(prev).add(id));
   200	
   201	    // reset visual after 2 seconds
   202	    setTimeout(() => {
   203	      setInsertedIds((prev) => {
   204	        const next = new Set(prev);
   205	        next.delete(id);
   206	        return next;
   207	      });
   208	    }, 2000);
   209	  };
   210	
   211	  const handleInsertAE = (ae: any, id: string) => {
   212	    let textToInsert = `Aprendizagem Essencial: ${ae.id}\n${ae.titulo}\n`;
   213	    if (ae.habilidadePriorizada)
   214	      textToInsert += `Habilidade Priorizada: ${ae.habilidadePriorizada}\n`;
   215	    if (ae.habilidadesRelacionadas)
   216	      textToInsert += `Habilidades Relacionadas: ${ae.habilidadesRelacionadas}\n`;
   217	    textToInsert += `\n`;
   218	
   219	    window.parent.postMessage(
   220	      {
   221	        type: "INSERT_TEXT",
   222	        text: textToInsert,
   223	      },
   224	      "*",
   225	    );
   226	
   227	    setInsertedIds((prev) => new Set(prev).add(id));
   228	    setTimeout(() => {
   229	      setInsertedIds((prev) => {
   230	        const next = new Set(prev);
   231	        next.delete(id);
   232	        return next;
   233	      });
   234	    }, 2000);
   235	  };
   236	
   237	  const renderAnos = () => (
   238	    <div className="grid grid-cols-2 gap-3">
   239	      {[6, 7, 8, 9].map((ano) => (
   240	        <button
   241	          key={ano}
   242	          onClick={() => setSelectedAno(ano)}
   243	          className="bg-white border text-center border-slate-200 rounded-xl p-3 shadow-sm hover:border-[#8257E5] hover:shadow-md transition-all group flex flex-col items-center justify-center gap-2"
   244	        >
   245	          <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-[#8257E5] font-bold text-lg group-hover:scale-110 transition-transform">
   246	            {ano}º
   247	          </div>
   248	          <span className="font-semibold text-slate-700 text-sm">
   249	            {ano}º Ano
   250	          </span>
   251	        </button>
   252	      ))}
   253	    </div>
   254	  );
   255	
   256	  return (
   257	    <div
   258	      className="bg-slate-50 text-slate-800 font-sans flex flex-col"
   259	      style={{
   260	        position: "fixed",
   261	        top: 0,
   262	        left: 0,
   263	        right: 0,
   264	        bottom: 0,
   265	        width: "100%",
   266	        height: "100%",
   267	        overflowY: "auto",
   268	        overflowX: "hidden",
   269	      }}
   270	    >
   271	      {/* Header compact - Sticky */}
   272	      <div className="sticky top-0 z-20 bg-white shadow-sm">
   273	        <div className="bg-[#8257E5] text-white p-3 shadow-md flex justify-between items-center">
   274	          <div className="flex items-center gap-2">
   275	            {selectedAno ? (
   276	              <button
   277	                onClick={() => setSelectedAno(null)}
   278	                className="hover:bg-white/20 p-1 -ml-1 rounded-full text-white transition-colors"
   279	              >
   280	                <ChevronLeft size={16} />
   281	              </button>
   282	            ) : (
   283	              <BookOpen size={16} />
   284	            )}
   285	            <h1 className="font-bold text-base leading-tight tracking-tight">
   286	              {selectedAno ? `${selectedAno}º Ano` : "Escopo EduAssistente"}
   287	            </h1>
   288	          </div>
   289	
   290	          <div className="flex items-center gap-1">
   291	            <button
   292	              onClick={() =>
   293	                setActiveTab(activeTab === "settings" ? "aulas" : "settings")
   294	              }
   295	              className={`hover:bg-white/20 p-1.5 rounded-full transition-colors flex items-center justify-center relative ${activeTab === "settings" ? "bg-white/20" : ""}`}
   296	              title="Configurações (Chave API)"
   297	            >
   298	              <Settings size={16} />
   299	            </button>
   300	            <button
   301	              onClick={() => fileInputRef.current?.click()}
   302	              className="hover:bg-white/20 p-1.5 rounded-full transition-colors flex items-center justify-center relative"
   303	              title="Importar Meu Escopo (PDF/CSV/JSON)"
   304	              disabled={isExtractingPDF}
   305	            >
   306	              {isExtractingPDF ? (
   307	                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
   308	              ) : (
   309	                <Upload size={16} />
   310	              )}
   311	            </button>
   312	          </div>
   313	          <input
   314	            type="file"
   315	            ref={fileInputRef}
   316	            onChange={handleFileUpload}
   317	            accept=".csv,.json,.pdf"
   318	            className="hidden"
   319	          />
   320	        </div>
   321	
   322	        {selectedAno && (
   323	          <div className="bg-[#8257E5] px-3 pb-3">
   324	            <div className="flex-1">
   325	              <select
   326	                value={bimestre}
   327	                onChange={(e) => setBimestre(Number(e.target.value))}
   328	                className="w-full bg-white/20 border border-white/30 text-white rounded-lg text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-white/50 [&>option]:text-slate-800"
   329	              >
   330	                <option value={1}>1º Bim</option>
   331	                <option value={2}>2º Bim</option>
   332	                <option value={3}>3º Bim</option>
   333	                <option value={4}>4º Bim</option>
   334	              </select>
   335	            </div>
   336	          </div>
   337	        )}
   338	
   339	        {/* Search */}
   340	        {selectedAno && (
   341	          <div className="bg-white border-b border-slate-200 shadow-sm relative z-10 flex flex-col">
   342	            <div className="px-3 py-2 border-b border-slate-100">
   343	              <div className="relative">
   344	                <Search
   345	                  size={14}
   346	                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
   347	                />
   348	                <input
   349	                  type="text"
   350	                  placeholder={
   351	                    activeTab === "aulas"
   352	                      ? "Buscar aula ou termo..."
   353	                      : "Buscar aprendizagem..."
   354	                  }
   355	                  value={searchTerm}
   356	                  onChange={(e) => setSearchTerm(e.target.value)}
   357	                  className="w-full pl-8 pr-3 py-1.5 bg-slate-100 border-none rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#8257E5]"
   358	                />
   359	              </div>
   360	            </div>
   361	
   362	            <div className="flex w-full">
   363	              <button
   364	                onClick={() => setActiveTab("aulas")}
   365	                className={`flex-1 py-2 text-xs font-semibold text-center border-b-2 transition-colors ${
   366	                  activeTab === "aulas"
   367	                    ? "border-[#8257E5] text-[#8257E5]"
   368	                    : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
   369	                }`}
   370	              >
   371	                Aulas
   372	              </button>
   373	              <button
   374	                onClick={() => setActiveTab("aes")}
   375	                className={`flex-1 py-2 text-xs font-semibold text-center border-b-2 transition-colors ${
   376	                  activeTab === "aes"
   377	                    ? "border-[#8257E5] text-[#8257E5]"
   378	                    : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
   379	                }`}
   380	              >
   381	                Aprendizagens (AE)
   382	              </button>
   383	            </div>
   384	          </div>
   385	        )}
   386	      </div>
   387	
   388	      {/* Timeline Content */}
   389	      <div className="flex-1 p-4 pb-12 relative">
   390	        {activeTab === "settings" ? (
   391	          <div className="bg-white border text-sm border-slate-200 rounded-xl p-4 shadow-sm">
   392	            <h3 className="font-bold text-slate-800 mb-2">
   393	              Configurações
   394	            </h3>
   395	            <p className="text-slate-600 mb-4 text-xs">
   396	              Todas as integrações e configurações de IA são gerenciadas automaticamente pelo servidor de forma segura.
   397	            </p>
   398	          </div>
   399	        ) : !selectedAno ? (
   400	          renderAnos()
   401	        ) : activeTab === "aulas" ? (
   402	          aulas.length === 0 ? (
   403	            <p className="text-center text-slate-500 text-sm mt-4">
   404	              Nenhuma aula encontrada.
   405	            </p>
   406	          ) : (
   407	            <div className="relative border-l-2 border-indigo-100 ml-3 space-y-6">
   408	              {aulas.map((aula, index) => {
   409	                const id = `${aula.ano}-${aula.bimestre}-${aula.numero}-${index}`;
   410	                const isInserted = insertedIds.has(id);
   411	                return (
   412	                  <div key={id} className="relative pl-6">
   413	                    <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-white border-2 border-[#8257E5] z-10" />
   414	
   415	                    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:border-indigo-300 transition-colors group">
   416	                      <div className="flex items-center gap-2 mb-1">
   417	                        <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
   418	                          Aula {aula.numero}
   419	                        </span>
   420	                        <h3 className="font-semibold text-sm text-slate-800 leading-tight">
   421	                          {aula.titulo || aula.conteudo}
   422	                        </h3>
   423	                      </div>
   424	
   425	                      <div className="flex flex-col gap-2 mb-3">
   426	                        {aula.aprendizagemEssencial &&
   427	                          aula.aprendizagemEssencial !== "-" && (
   428	                            <div>
   429	                              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
   430	                                Aprendizagem Essencial
   431	                              </span>
   432	                              <p className="text-xs text-slate-600 leading-snug whitespace-pre-wrap">
   433	                                {getDetalheAprendizagem(
   434	                                  aula.ano,
   435	                                  aula.bimestre,
   436	                                  aula.aprendizagemEssencial,
   437	                                )}
   438	                              </p>
   439	                            </div>
   440	                          )}
   441	
   442	                        {aula.habilidades && aula.habilidades.length > 0 && (
   443	                          <div>
   444	                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
   445	                              Habilidades
   446	                            </span>
   447	                            <div className="text-xs text-slate-600 leading-snug space-y-1">
   448	                              {(Array.isArray(aula.habilidades)
   449	                                ? aula.habilidades
   450	                                : aula.habilidades.split(",")
   451	                              ).map((h) => {
   452	                                const code = h.trim();
   453	                                const desc = bnccHabilidades[code];
   454	                                return (
   455	                                  <p key={code} className="mb-1">
   456	                                    <span className="font-semibold">
   457	                                      ({code})
   458	                                    </span>
   459	                                    {desc ? ` ${desc}` : ""}
   460	                                  </p>
   461	                                );
   462	                              })}
   463	                            </div>
   464	                          </div>
   465	                        )}
   466	
   467	                        <div>
   468	                          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
   469	                            Objetivos
   470	                          </span>
   471	                          <p className="text-xs text-slate-600 leading-snug">
   472	                            {aula.objetivos || "Sem objetivos cadastrados."}
   473	                          </p>
   474	                        </div>
   475	                      </div>
   476	
   477	                      <button
   478	                        onClick={() => handleInsert(aula, id)}
   479	                        className={`w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
   480	                          isInserted
   481	                            ? "bg-green-100 text-green-700"
   482	                            : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
   483	                        }`}
   484	                      >
   485	                        {isInserted ? (
   486	                          <>
   487	                            <CheckCircle2 size={14} />
   488	                            Inserido!
   489	                          </>
   490	                        ) : (
   491	                          <>
   492	                            <PlusCircle size={14} />
   493	                            Inserir no Doc
   494	                          </>
   495	                        )}
   496	                      </button>
   497	                    </div>
   498	                  </div>
   499	                );
   500	              })}
   501	            </div>
   502	          )
   503	        ) : activeTab === "aes" ? (
   504	          aes.length === 0 ? (
   505	            <p className="text-center text-slate-500 text-sm mt-4">
   506	              Nenhuma aprendizagem essencial encontrada.
   507	            </p>
   508	          ) : (
   509	            <div className="space-y-4">
   510	              {aes.map((ae, index) => {
   511	                const id = `ae-${ae.ano}-${ae.bimestre}-${ae.id}-${index}`;
   512	                const isInserted = insertedIds.has(id);
   513	                const aulasRelacionadas = dbAulas
   514	                  .filter(
   515	                    (a) =>
   516	                      a.ano === ae.ano &&
   517	                      a.bimestre === ae.bimestre &&
   518	                      a.aprendizagemEssencial
   519	                        .split(",")
   520	                        .map((s) => s.trim())
   521	                        .includes(ae.id),
   522	                  )
   523	                  .map((a) => a.numero)
   524	                  .sort((a, b) => a - b);
   525	                const aulasStr = formatAulasList(aulasRelacionadas);
   526	
   527	                return (
   528	                  <div
   529	                    key={id}
   530	                    className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:border-indigo-300 transition-colors group"
   531	                  >
   532	                    <div className="flex items-start gap-2 mb-2">
   533	                      <span className="bg-emerald-100 text-emerald-700 text-[10px] whitespace-nowrap font-bold px-2 py-0.5 rounded-full shrink-0">
   534	                        {ae.id}
   535	                      </span>
   536	                      <div className="flex-1">
   537	                        {aulasStr && (
   538	                          <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">
   539	                            {aulasStr.includes("a") || aulasStr.includes(",")
   540	                              ? "Engloba as Aulas "
   541	                              : "Engloba a Aula "}
   542	                            {aulasStr}
   543	                          </div>
   544	                        )}
   545	                        <h3 className="font-semibold text-sm text-slate-800 leading-tight">
   546	                          {ae.titulo}
   547	                        </h3>
   548	                      </div>
   549	                    </div>
   550	
   551	                    <div className="flex flex-col gap-2 mb-3">
   552	                      {ae.habilidadePriorizada && (
   553	                        <div>
   554	                          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
   555	                            Habilidade Priorizada
   556	                          </span>
   557	                          <div className="text-xs text-slate-600 leading-snug space-y-1">
   558	                            {ae.habilidadePriorizada.split(",").map((h) => {
   559	                              const code = h.trim();
   560	                              const desc = bnccHabilidades[code];
   561	                              return (
   562	                                <p key={code} className="mb-1">
   563	                                  <span className="font-semibold">
   564	                                    ({code})
   565	                                  </span>
   566	                                  {desc ? ` ${desc}` : ""}
   567	                                </p>
   568	                              );
   569	                            })}
   570	                          </div>
   571	                        </div>
   572	                      )}
   573	
   574	                      {ae.habilidadesRelacionadas && (
   575	                        <div>
   576	                          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
   577	                            Habilidades Relacionadas
   578	                          </span>
   579	                          <div className="text-xs text-slate-600 leading-snug space-y-1">
   580	                            {ae.habilidadesRelacionadas.split(",").map((h) => {
   581	                              const code = h.trim();
   582	                              const desc = bnccHabilidades[code];
   583	                              return (
   584	                                <p key={code} className="mb-1">
   585	                                  <span className="font-semibold">
   586	                                    ({code})
   587	                                  </span>
   588	                                  {desc ? ` ${desc}` : ""}
   589	                                </p>
   590	                              );
   591	                            })}
   592	                          </div>
   593	                        </div>
   594	                      )}
   595	                    </div>
   596	
   597	                    <button
   598	                      onClick={() => handleInsertAE(ae, id)}
   599	                      className={`w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
   600	                        isInserted
   601	                          ? "bg-green-100 text-green-700"
   602	                          : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
   603	                      }`}
   604	                    >
   605	                      {isInserted ? (
   606	                        <>
   607	                          <CheckCircle2 size={14} />
   608	                          Inserido!
   609	                        </>
   610	                      ) : (
   611	                        <>
   612	                          <PlusCircle size={14} />
   613	                          Inserir no Doc
   614	                        </>
   615	                      )}
   616	                    </button>
   617	                  </div>
   618	                );
   619	              })}
   620	            </div>
   621	          )
   622	        ) : null}
   623	      </div>
   624	    </div>
   625	  );
   626	}
