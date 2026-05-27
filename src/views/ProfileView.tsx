import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { useAuth } from "../contexts/AuthContext";
import { updateProfile } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  Camera,
  User,
  Users,
  Database,
  BookOpen,
  ChevronRight,
  Save,
  LogOut,
  ImagePlus,
} from "lucide-react";
import { auth, storage } from "../lib/firebase";

import { useAppStore } from "../store/useAppStore";

export default function ProfileView() {
  const { user, logout } = useAuth();
  const { setCurrentView } = useAppStore();

  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [photoURL, setPhotoURL] = useState(user?.photoURL || "");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || "");
      setPhotoURL(user.photoURL || "");
    }
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await updateProfile(user, {
        displayName,
        photoURL,
      });
      setIsEditing(false);
      // Small trick to force image and name reload in UI
      // since firebase auth updateProfile doesn't always trigger context update natively without reload
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert("Erro ao atualizar o perfil");
    }
    setIsSaving(false);
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center p-12 h-full text-slate-500">
        <User size={64} className="mb-4 text-slate-300" />
        <p className="text-xl font-bold text-slate-800">
          Faça login para ver seu perfil
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto flex flex-col gap-8 pb-10"
    >
      <div className="flex items-center justify-between">
        <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
          <User className="text-indigo-600" size={32} /> Meu Perfil
        </h1>
        <button
          onClick={() => logout()}
          className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-colors"
        >
          <LogOut size={18} />{" "}
          <span className="hidden sm:inline">Sair da Conta</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personal Info Card */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 lg:p-8 shrink-0 flex flex-col gap-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold text-slate-800">Dados Pessoais</h2>
          </div>

          <div className="flex items-center gap-6">
            <div className="relative shrink-0">
              <div className="w-24 h-24 rounded-full border-4 border-indigo-50 shadow-md overflow-hidden bg-slate-100">
                <img
                  src={
                    photoURL ||
                    "https://ui-avatars.com/api/?name=Professor&background=6366f1&color=fff"
                  }
                  alt="Perfil"
                  className="w-full h-full object-cover"
                />
              </div>
              {isEditing && (
                <div className="absolute inset-0 bg-slate-900/40 rounded-full flex items-center justify-center pointer-events-none">
                  <Camera size={24} className="text-white" />
                </div>
              )}
            </div>

            <div className="flex flex-col flex-1 min-w-0 font-medium">
              {isEditing ? (
                 <div className="flex flex-col gap-3 w-full">
                  <label className="text-sm font-bold text-slate-600">
                    Nome de Exibição
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="p-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-full"
                  />
                  <label className="text-sm font-bold text-slate-600 mt-2">
                    Foto de Perfil (Opcional)
                  </label>
                  <label className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/50 rounded-xl cursor-pointer transition-colors text-sm font-medium text-indigo-700 w-full text-center justify-center">
                    <ImagePlus size={18} />
                    <span>Escolher foto da Galeria</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 5 * 1024 * 1024) {
                            alert("A imagem deve ser menor que 5MB.");
                            return;
                          }
                          setIsSaving(true);
                          try {
                            const ext = file.name.split('.').pop() || 'jpg';
                            const storageRef = ref(storage, `users/${user.uid}/profile_${Date.now()}.${ext}`);
                            await uploadBytes(storageRef, file);
                            const url = await getDownloadURL(storageRef);
                            setPhotoURL(url);
                          } catch (err: any) {
                            console.error(err);
                            alert("Erro ao enviar imagem. Detalhe: " + err.message);
                          } finally {
                            setIsSaving(false);
                          }
                        }
                      }}
                    />
                  </label>
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => setIsEditing(false)}
                      className="flex-1 py-2 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSaveProfile}
                      disabled={isSaving}
                      className="flex-1 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      {isSaving ? (
                        "Salvando..."
                      ) : (
                        <>
                          <Save size={16} /> Salvar
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-start min-w-0">
                  <span className="text-xl font-bold text-slate-800 truncate block w-full">
                    {user.displayName || "Sem Nome"}
                  </span>
                  <span className="text-sm text-slate-500 truncate mb-4">
                    {user.email}
                  </span>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-sm font-bold text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl border-indigo-100 border hover:bg-indigo-100 transition-colors"
                  >
                    Editar Perfil
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Settings / Configuration Card */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 lg:p-8 flex flex-col gap-6">
          <div className="mb-2">
            <h2 className="text-lg font-bold text-slate-800">
              Configurações e Banco de Dados
            </h2>
            <p className="text-sm font-medium text-slate-500 mt-1">
              Gerencie os dados sensíveis do sistema.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => setCurrentView("alunos")}
              className="flex items-center justify-between p-4 bg-slate-50 hover:bg-indigo-50 rounded-2xl border border-slate-200 hover:border-indigo-200 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                  <Users size={18} />
                </div>
                <div className="flex flex-col text-left">
                  <span className="font-bold text-slate-800">
                    Banco de Alunos
                  </span>
                  <span className="text-xs font-medium text-slate-500">
                    Gerenciar alunos, RAs e turmas
                  </span>
                </div>
              </div>
              <ChevronRight className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
            </button>

            <button
              onClick={() => setCurrentView("jarvis")}
              className="flex items-center justify-between p-4 bg-slate-50 hover:bg-amber-50 rounded-2xl border border-slate-200 hover:border-amber-200 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                  <Database size={18} />
                </div>
                <div className="flex flex-col text-left">
                  <span className="font-bold text-slate-800">
                    Documentos Jarvis
                  </span>
                  <span className="text-xs font-medium text-slate-500">
                    Base de conhecimento da IA
                  </span>
                </div>
              </div>
              <ChevronRight className="text-slate-400 group-hover:text-amber-600 transition-colors" />
            </button>

            <button
              onClick={() => setCurrentView("conhecimento")}
              className="flex items-center justify-between p-4 bg-slate-50 hover:bg-emerald-50 rounded-2xl border border-slate-200 hover:border-emerald-200 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <BookOpen size={18} />
                </div>
                <div className="flex flex-col text-left">
                  <span className="font-bold text-slate-800">
                    Treinamento & Datas
                  </span>
                  <span className="text-xs font-medium text-slate-500">
                    Dados do ano e feriados
                  </span>
                </div>
              </div>
              <ChevronRight className="text-slate-400 group-hover:text-emerald-600 transition-colors" />
            </button>

            <button
              onClick={() => setCurrentView("grade")}
              className="flex items-center justify-between p-4 bg-slate-50 hover:bg-blue-50 rounded-2xl border border-slate-200 hover:border-blue-200 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="3" y1="12" x2="21" y2="12"></line>
                    <line x1="3" y1="6" x2="21" y2="6"></line>
                    <line x1="3" y1="18" x2="21" y2="18"></line>
                    <line x1="12" y1="3" x2="12" y2="21"></line>
                  </svg>
                </div>
                <div className="flex flex-col text-left">
                  <span className="font-bold text-slate-800">
                    Grade de Horários
                  </span>
                  <span className="text-xs font-medium text-slate-500">
                    Cronograma de aulas da semana
                  </span>
                </div>
              </div>
              <ChevronRight className="text-slate-400 group-hover:text-blue-600 transition-colors" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
