"use client";

import { useState, useTransition } from "react";
import { createGroup, joinGroup } from "./actions";
import { Trophy, Plus, LogIn, AlertCircle, Loader2, Shield } from "lucide-react";

export default function HomePage() {
  // Estados para Crear Grupo
  const [createName, setCreateName] = useState("");
  const [createCode, setCreateCode] = useState("");
  const [createError, setCreateError] = useState("");
  const [isPendingCreate, startCreateTransition] = useTransition();

  // Estados para Unirse a Grupo
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [joinError, setJoinError] = useState("");
  const [isPendingJoin, startJoinTransition] = useTransition();

  // Manejador para crear grupo
  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    
    if (!createName.trim()) {
      setCreateError("El nombre del grupo es obligatorio.");
      return;
    }
    if (!createCode.trim()) {
      setCreateError("El código secreto es obligatorio.");
      return;
    }

    startCreateTransition(async () => {
      const response = await createGroup(createName, createCode);
      if (!response.success) {
        setCreateError(response.error || "Ocurrió un error inesperado.");
      }
    });
  };

  // Manejador para unirse a grupo
  const handleJoinGroup = (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError("");

    if (!joinCodeInput.trim()) {
      setJoinError("Debes ingresar el código secreto.");
      return;
    }

    startJoinTransition(async () => {
      const response = await joinGroup(joinCodeInput);
      if (!response.success) {
        setJoinError(response.error || "Código secreto inválido.");
      }
    });
  };

  return (
    <main className="flex-1 flex flex-col justify-center items-center px-4 py-12 md:py-24 relative">
      {/* Elementos Decorativos de Fondo */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-[250px] h-[250px] bg-amber-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Contenedor Principal */}
      <div className="w-full max-w-4xl z-10">
        
        {/* Cabecera / Hero */}
        <header className="text-center mb-12">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-4 pulse-badge">
            <Trophy className="w-3.5 h-3.5" /> Copa Mundial FIFA 2026
          </span>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight bg-gradient-to-r from-emerald-400 via-amber-300 to-amber-500 bg-clip-text text-transparent mb-4">
            Polla Mundialista
          </h1>
          <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto font-light leading-relaxed">
            Crea grupos privados, invita a tus amigos con un código secreto y apuesta en los partidos de inauguración del mundial. Gestiona resultados en tiempo real y calcula posiciones de forma automática.
          </p>
        </header>

        {/* Formularios - Lado a Lado en pantallas medianas */}
        <div className="grid md:grid-cols-2 gap-8 mt-8">
          
          {/* Card: Crear Grupo */}
          <section className="glass-panel p-6 md:p-8 flex flex-col justify-between relative overflow-hidden" id="section-create">
            <div className="shimmer-effect absolute inset-0 pointer-events-none" />
            <div>
              <div className="flex items-center gap-3.5 mb-6">
                <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/25 text-emerald-400">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-100">Crear Nuevo Grupo</h2>
                  <p className="text-xs text-slate-400">Genera una tabla privada para competir</p>
                </div>
              </div>

              <form onSubmit={handleCreateGroup} className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="create-name-input" className="text-xs font-medium text-slate-300">
                    Nombre del Grupo
                  </label>
                  <input
                    id="create-name-input"
                    type="text"
                    placeholder="Ej. Oficina Central, Los Cracks"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    disabled={isPendingCreate}
                    className="glass-input text-sm"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="create-code-input" className="text-xs font-medium text-slate-300">
                    Código Secreto de Acceso
                  </label>
                  <div className="relative">
                    <Shield className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                    <input
                      id="create-code-input"
                      type="text"
                      placeholder="Ej. mundial2026, los-pibes"
                      value={createCode}
                      onChange={(e) => setCreateCode(e.target.value)}
                      disabled={isPendingCreate}
                      className="glass-input-prefix w-full text-sm"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Este código servirá para invitar a otros miembros a unirse.
                  </p>
                </div>

                {createError && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{createError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isPendingCreate}
                  className="btn-green w-full mt-4 cursor-pointer py-3.5 text-sm"
                  id="btn-create-submit"
                >
                  {isPendingCreate ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creando Grupo...
                    </span>
                  ) : (
                    "Crear Grupo e Ingresar"
                  )}
                </button>
              </form>
            </div>
          </section>

          {/* Card: Unirse a Grupo */}
          <section className="glass-panel p-6 md:p-8 flex flex-col justify-between relative overflow-hidden" id="section-join">
            <div className="shimmer-effect absolute inset-0 pointer-events-none" />
            <div>
              <div className="flex items-center gap-3.5 mb-6">
                <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/25 text-amber-400">
                  <LogIn className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-100">Ingresar a un Grupo</h2>
                  <p className="text-xs text-slate-400">Accede a una tabla usando su código</p>
                </div>
              </div>

              <form onSubmit={handleJoinGroup} className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="join-code-input" className="text-xs font-medium text-slate-300">
                    Código Secreto del Grupo
                  </label>
                  <div className="relative">
                    <Shield className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                    <input
                      id="join-code-input"
                      type="text"
                      placeholder="Escribe el código de acceso..."
                      value={joinCodeInput}
                      onChange={(e) => setJoinCodeInput(e.target.value)}
                      disabled={isPendingJoin}
                      className="glass-input-prefix w-full text-sm"
                    />
                  </div>
                </div>

                {joinError && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{joinError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isPendingJoin}
                  className="btn-gold w-full mt-4 cursor-pointer py-3.5 text-sm"
                  id="btn-join-submit"
                >
                  {isPendingJoin ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Verificando Código...
                    </span>
                  ) : (
                    "Ingresar al Grupo"
                  )}
                </button>
              </form>
            </div>
            
            {/* Pequeña Info de Ayuda */}
            <div className="mt-8 pt-4 border-t border-slate-800/60 text-[11px] text-slate-500 text-center">
              Las apuestas están totalmente aisladas entre distintos grupos para mayor seguridad.
            </div>
          </section>

        </div>

        {/* Sección Informativa Inferior */}
        <footer className="mt-16 text-center text-xs text-slate-500 border-t border-slate-800/40 pt-6">
          <p>© 2026 Polla Mundialista. Construido con tecnología Next.js y Supabase.</p>
          <p className="mt-1.5 text-slate-600">Soporte automático para zona horaria de Bolivia (UTC-4).</p>
        </footer>

      </div>
    </main>
  );
}
