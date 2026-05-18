import React, { useState } from "react";
import { Search } from "lucide-react";
import { dbMatriz, MatrizDescritor } from "../../data/guiaPedagogico";
import { cn } from "../../lib/utils";

export default function MatrizProvaPaulista({ ano }: { ano: number }) {
  const [searchTerm, setSearchTerm] = useState("");

  const items = dbMatriz.filter(m => 
    m.ano === ano &&
    (m.habilidade.toLowerCase().includes(searchTerm.toLowerCase()) ||
     m.grupo1.toLowerCase().includes(searchTerm.toLowerCase()) ||
     m.grupo2.toLowerCase().includes(searchTerm.toLowerCase()) ||
     m.grupo3.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text"
            placeholder="Buscar descritores ou habilidades..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-11 pr-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
          />
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-auto scrollbar-thin border border-slate-200 rounded-2xl bg-white shadow-sm">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-slate-50 text-sm">
              <th className="p-4 font-semibold text-slate-600 border-b border-slate-200 w-48">Habilidade (AE)</th>
              <th className="p-4 font-semibold text-slate-600 border-b border-slate-200 w-1/3">Grupo 1 (Reconhecimento)</th>
              <th className="p-4 font-semibold text-slate-600 border-b border-slate-200 w-1/3">Grupo 2 (Aplicação/Organização)</th>
              <th className="p-4 font-semibold text-slate-600 border-b border-slate-200 w-1/3">Grupo 3 (Resolução Complexa)</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                 <td colSpan={4} className="p-8 text-center text-slate-500">Nenhum descritor encontrado neste protótipo.</td>
              </tr>
            ) : (
              items.map((item, i) => (
                <tr key={i} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-0 text-slate-700">
                  <td className="p-4 align-top">
                    <span className="inline-block bg-indigo-50 text-indigo-700 text-xs font-bold px-2 py-1 rounded-md border border-indigo-100">
                      {item.habilidade}
                    </span>
                  </td>
                  <td className="p-4 align-top text-sm">{item.grupo1}</td>
                  <td className="p-4 align-top text-sm">{item.grupo2}</td>
                  <td className="p-4 align-top text-sm">{item.grupo3}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
