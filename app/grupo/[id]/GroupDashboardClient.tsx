"use client";

import { useState, useEffect, useTransition } from "react";
import { placeBet, updateMatchScore, leaveGroup } from "../../actions";
import { createClient } from "@/utils/supabase/client";
import { getFlagSVG } from "@/utils/flags";
import { 
  Trophy, 
  Copy, 
  Check, 
  LogOut, 
  Coins, 
  Ticket, 
  Medal, 
  Wrench, 
  Clock, 
  PlusCircle, 
  CheckCircle2, 
  AlertCircle, 
  ClipboardList, 
  RotateCcw,
  Sparkles,
  Loader2,
  Users
} from "lucide-react";

interface Group {
  id: string;
  name: string;
  code: string;
}

interface Match {
  id: string;
  team_a: string;
  team_b: string;
  kickoff_time: string;
  score_a: number | null;
  score_b: number | null;
  status: "scheduled" | "live" | "finished";
  group_stage?: string;
}

interface Bet {
  id: string;
  participant_name: string;
  predicted_score_a: number;
  predicted_score_b: number;
  amount: number;
  created_at: string;
  match_id: string;
  points_won: number;
  result_status: "pending" | "exact" | "outcome" | "fail";
  matches: {
    team_a: string;
    team_b: string;
    score_a: number | null;
    score_b: number | null;
    status: "scheduled" | "live" | "finished";
  } | null;
}

interface GroupDashboardProps {
  group: Group;
  initialMatches: Match[];
  initialBets: any[];
}

function getFlag(team: string): React.JSX.Element {
  return getFlagSVG(team);
}

// Formateador de Fecha a Hora de Bolivia (UTC-4)
function formatToBoliviaTime(dateString: string) {
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("es-BO", {
      timeZone: "America/La_Paz",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(date);
  } catch (e) {
    return dateString;
  }
}

// Evaluar el resultado de una apuesta (leyendo desde la base de datos)
function evaluateBet(bet: Bet) {
  if (bet.result_status === "pending") {
    return {
      label: "Pendiente",
      badgeClass: "bg-slate-500/10 text-slate-400 border-slate-500/20",
      points: 0,
      status: "pending",
    };
  }

  if (bet.result_status === "exact") {
    return {
      label: "Acierto Exacto (+3 pts)",
      badgeClass: "bg-amber-500/20 text-amber-400 border-amber-500/30 font-semibold shadow-[0_0_10px_rgba(251,191,36,0.15)]",
      points: 3,
      status: "exact",
    };
  }

  if (bet.result_status === "outcome") {
    return {
      label: "Resultado Acertado (+1 pt)",
      badgeClass: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      points: 1,
      status: "outcome",
    };
  }

  return {
    label: "No Acertado (0 pts)",
    badgeClass: "bg-rose-500/10 text-rose-500/60 border-rose-500/10",
    points: 0,
    status: "fail",
  };
}

export default function GroupDashboardClient({
  group,
  initialMatches,
  initialBets,
}: GroupDashboardProps) {
  const [matches, setMatches] = useState<Match[]>(initialMatches);
  const [bets, setBets] = useState<Bet[]>(initialBets);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(
    initialMatches.length > 0 ? initialMatches[0] : null
  );

  // Formulario Apuesta
  const [participantName, setParticipantName] = useState("");
  const [predScoreA, setPredScoreA] = useState("0");
  const [predScoreB, setPredScoreB] = useState("0");
  const [betAmount, setBetAmount] = useState("10");
  const [betError, setBetError] = useState("");
  const [betSuccess, setBetSuccess] = useState(false);
  const [isPendingBet, startBetTransition] = useTransition();

  // Modo Simulador de Resultados
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [simScoreA, setSimScoreA] = useState("0");
  const [simScoreB, setSimScoreB] = useState("0");
  const [simError, setSimError] = useState("");
  const [isPendingSim, startSimTransition] = useTransition();

  // Copiar código de grupo
  const [copied, setCopied] = useState(false);

  // Cuenta regresiva
  const [now, setNow] = useState(new Date());

  // Suscribirse a cambios en tiempo real con Supabase
  useEffect(() => {
    const supabase = createClient();

    // Cargar nombre del participante guardado en localStorage
    const savedName = localStorage.getItem("polla_participant_name");
    if (savedName) {
      setParticipantName(savedName);
    }

    // Suscripción en tiempo real a la tabla matches
    const matchesChannel = supabase
      .channel("realtime-matches")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches" },
        async () => {
          // Refrescar partidos
          const { data: updatedMatches } = await supabase
            .from("matches")
            .select("id, team_a, team_b, kickoff_time, score_a, score_b, status, group_stage")
            .order("kickoff_time", { ascending: true });
          if (updatedMatches) {
            setMatches(updatedMatches);
            // Actualizar partido seleccionado
            if (selectedMatch) {
              const currentSel = updatedMatches.find((m) => m.id === selectedMatch.id);
              if (currentSel) {
                setSelectedMatch(currentSel);
              }
            }
          }
        }
      )
      .subscribe();

    // Suscripción en tiempo real a la tabla bets
    const betsChannel = supabase
      .channel("realtime-bets")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bets" },
        async () => {
          // Refrescar apuestas con join
          const { data: updatedBets } = await supabase
            .from("bets")
            .select(`
              id,
              participant_name,
              predicted_score_a,
              predicted_score_b,
              amount,
              created_at,
              match_id,
              points_won,
              result_status,
              matches (
                team_a,
                team_b,
                score_a,
                score_b,
                status
              )
            `)
            .eq("group_id", group.id)
            .order("created_at", { ascending: false });
          if (updatedBets) {
            const mappedBets = updatedBets.map((b: any) => ({
              ...b,
              matches: Array.isArray(b.matches) ? b.matches[0] : (b.matches || null)
            })) as Bet[];
            setBets(mappedBets);
          }
        }
      )
      .subscribe();

    // Actualizar reloj de cuenta regresiva
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => {
      supabase.removeChannel(matchesChannel);
      supabase.removeChannel(betsChannel);
      clearInterval(timer);
    };
  }, [group.id, selectedMatch]);

  // Actualizar valores de simulación cuando cambia el partido seleccionado
  useEffect(() => {
    if (selectedMatch) {
      setSimScoreA(selectedMatch.score_a !== null ? String(selectedMatch.score_a) : "0");
      setSimScoreB(selectedMatch.score_b !== null ? String(selectedMatch.score_b) : "0");
    }
  }, [selectedMatch]);

  // Copiar código secreto al portapapeles
  const handleCopyCode = () => {
    navigator.clipboard.writeText(group.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Enviar Apuesta
  const handlePlaceBet = (e: React.FormEvent) => {
    e.preventDefault();
    setBetError("");
    setBetSuccess(false);

    if (!selectedMatch) {
      setBetError("Selecciona un partido para apostar.");
      return;
    }
    if (!participantName.trim()) {
      setBetError("El nombre del participante es obligatorio.");
      return;
    }

    const pA = parseInt(predScoreA);
    const pB = parseInt(predScoreB);
    const amt = parseFloat(betAmount);

    if (isNaN(pA) || pA < 0 || isNaN(pB) || pB < 0) {
      setBetError("Ingresa marcadores válidos (0 o mayores).");
      return;
    }
    if (isNaN(amt) || amt <= 0) {
      setBetError("El monto apostado debe ser un número mayor a 0.");
      return;
    }

    // Persistir nombre
    localStorage.setItem("polla_participant_name", participantName.trim());

    startBetTransition(async () => {
      const res = await placeBet(group.id, selectedMatch.id, participantName, pA, pB, amt);
      if (res.success) {
        setBetSuccess(true);
        // Limpiar marcador para evitar doble envío accidental
        setPredScoreA("0");
        setPredScoreB("0");
        setTimeout(() => setBetSuccess(false), 3000);
      } else {
        setBetError(res.error || "Error al registrar la apuesta.");
      }
    });
  };

  // Simular Marcador
  const handleSimulateScore = (e: React.FormEvent) => {
    e.preventDefault();
    setSimError("");

    if (!selectedMatch) return;

    const sA = simScoreA.trim() === "" ? null : parseInt(simScoreA);
    const sB = simScoreB.trim() === "" ? null : parseInt(simScoreB);

    if ((sA !== null && isNaN(sA)) || (sB !== null && isNaN(sB))) {
      setSimError("Introduce números válidos o deja en blanco.");
      return;
    }

    startSimTransition(async () => {
      const res = await updateMatchScore(group.id, selectedMatch.id, sA, sB);
      if (!res.success) {
        setSimError(res.error || "Error al actualizar el marcador.");
      }
    });
  };

  // Limpiar el marcador del partido (Volver a programado)
  const handleResetMatch = () => {
    startSimTransition(async () => {
      const res = await updateMatchScore(group.id, selectedMatch!.id, null, null);
      if (!res.success) {
        setSimError(res.error || "Error al reiniciar el partido.");
      }
    });
  };

  // Obtener cuenta regresiva en formato legible
  const getCountdownString = (kickoffTimeStr: string, matchStatus: string) => {
    if (matchStatus === "finished") return "Finalizado";

    const kickoff = new Date(kickoffTimeStr);
    const diff = kickoff.getTime() - now.getTime();

    if (diff <= 0) {
      return "En juego (En Vivo)";
    }

    const secs = Math.floor(diff / 1000);
    const mins = Math.floor(secs / 60);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `Faltan ${days} d y ${hours % 24} h`;
    }
    
    const displayHours = String(hours).padStart(2, "0");
    const displayMins = String(mins % 60).padStart(2, "0");
    const displaySecs = String(secs % 60).padStart(2, "0");

    return `Empieza en: ${displayHours}:${displayMins}:${displaySecs}`;
  };

  // Estadísticas globales del grupo
  const totalPool = bets.reduce((acc, b) => acc + Number(b.amount), 0);
  const totalBets = bets.length;

  // Tabla de Clasificación de Participantes
  const participantStats: Record<
    string,
    { name: string; points: number; exact: number; outcome: number; totalBets: number; totalAmount: number }
  > = {};

  bets.forEach((bet) => {
    const name = bet.participant_name;
    if (!participantStats[name]) {
      participantStats[name] = { name, points: 0, exact: 0, outcome: 0, totalBets: 0, totalAmount: 0 };
    }
    
    const evaluation = evaluateBet(bet);
    participantStats[name].points += evaluation.points;
    participantStats[name].totalBets += 1;
    participantStats[name].totalAmount += Number(bet.amount);

    if (evaluation.status === "exact") {
      participantStats[name].exact += 1;
    } else if (evaluation.status === "outcome") {
      participantStats[name].outcome += 1;
    }
  });

  const leaderboard = Object.values(participantStats).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.exact !== a.exact) return b.exact - a.exact;
    return b.totalAmount - a.totalAmount;
  });

  const currentLeader = leaderboard.length > 0 ? leaderboard[0].name : "Ninguno aún";

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 max-w-7xl mx-auto w-full relative">
      {/* Luces decorativas */}
      <div className="absolute top-10 left-1/4 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Cabecera del Dashboard */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 z-10">
        <div>
          <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full uppercase">
            Grupo Privado
          </span>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-100 mt-2 flex items-center gap-2">
            <Trophy className="w-8 h-8 text-amber-400 shrink-0" /> {group.name}
          </h1>
        </div>

        {/* Acciones de Cabecera */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Compartir Código */}
          <div className="flex items-center gap-2 bg-slate-900/60 border border-white/10 rounded-lg p-2.5 text-sm w-full md:w-auto justify-between">
            <span className="text-slate-400">Código de acceso:</span>
            <code className="text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/25">
              {group.code}
            </code>
            <button
              onClick={handleCopyCode}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded border border-white/10 transition cursor-pointer"
            >
              {copied ? (
                <span className="flex items-center gap-1">
                  ¡Copiado! <Check className="w-3.5 h-3.5" />
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  Copiar <Copy className="w-3.5 h-3.5" />
                </span>
              )}
            </button>
          </div>

          {/* Salir */}
          <button
            onClick={() => leaveGroup(group.id)}
            className="btn-outline text-xs px-4 py-2.5 cursor-pointer w-full md:w-auto"
          >
            <span className="flex items-center gap-1.5">
              <LogOut className="w-4 h-4" /> Salir del Grupo
            </span>
          </button>
        </div>
      </header>

      {/* Grid de Estadísticas Rápidas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8 z-10">
        {/* Pozo */}
        <div className="glass-panel p-5 relative overflow-hidden flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Pozo Acumulado</p>
            <h3 className="text-3xl font-black text-emerald-400 mt-1">
              {totalPool.toFixed(0)} <span className="text-sm font-normal text-slate-400">Bs.</span>
            </h3>
          </div>
          <span className="text-3xl bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 text-emerald-400">
            <Coins className="w-6 h-6" />
          </span>
        </div>

        {/* Total Apuestas */}
        <div className="glass-panel p-5 relative overflow-hidden flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Total Apuestas</p>
            <h3 className="text-3xl font-black text-amber-400 mt-1">{totalBets}</h3>
          </div>
          <span className="text-3xl bg-amber-500/10 p-3 rounded-xl border border-amber-500/20 text-amber-450">
            <Ticket className="w-6 h-6" />
          </span>
        </div>

        {/* Líder */}
        <div className="glass-panel p-5 relative overflow-hidden flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Líder Actual</p>
            <h3 className="text-lg font-bold text-slate-100 truncate max-w-[180px] mt-2 flex items-center gap-1.5">
              <Medal className="w-4 h-4 text-emerald-400 shrink-0" /> {currentLeader}
            </h3>
          </div>
          <span className="text-3xl bg-blue-500/10 p-3 rounded-xl border border-blue-500/20 text-amber-400">
            <Trophy className="w-6 h-6" />
          </span>
        </div>
      </div>

      {/* Controles de Vista de Administrador/Simulador */}
      <div className="glass-panel p-4 mb-8 z-10 flex items-center justify-between border-dashed border-emerald-500/30">
        <div className="flex items-center gap-3">
          <Wrench className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <h4 className="text-sm font-bold text-slate-200">Simulador de Resultados del Mundial</h4>
            <p className="text-xs text-slate-400">Activa este modo para actualizar marcadores y probar el cálculo de ganadores.</p>
          </div>
        </div>
        <button
          onClick={() => setIsAdminMode(!isAdminMode)}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition border cursor-pointer ${
            isAdminMode
              ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
              : "bg-slate-800 border-white/10 text-slate-400 hover:text-slate-200"
          }`}
        >
          {isAdminMode ? (
            <span className="flex items-center gap-1.5">
              Desactivar Simulador
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              Activar Simulador <Sparkles className="w-3.5 h-3.5" />
            </span>
          )}
        </button>
      </div>

      {/* Grid Principal de 3 Columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8 z-10 items-start">
        
        {/* Columna 1: Partidos (lg:col-span-4) */}
        <section className="lg:col-span-4 space-y-4" id="section-matches-list">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-lg font-extrabold text-slate-200">Partidos del Mundial</h2>
            <span className="text-[10px] text-slate-500 uppercase">Hora Bolivia (UTC-4)</span>
          </div>

          <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
            {matches.map((match) => {
              const isSelected = selectedMatch?.id === match.id;
              return (
                <div
                  key={match.id}
                  onClick={() => setSelectedMatch(match)}
                  className={`glass-panel p-4 cursor-pointer relative transition-all ${
                    isSelected
                      ? "border-emerald-500/50 bg-emerald-500/5 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                      : "hover:border-white/15"
                  }`}
                >
                  <div className="flex justify-between items-center mb-3 text-xs">
                    <span className="text-slate-500 font-semibold">{match.group_stage}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full font-medium flex items-center ${
                        match.status === "finished"
                          ? "bg-slate-800 text-slate-400"
                          : match.status === "live" || new Date(match.kickoff_time) <= now
                          ? "bg-rose-500/20 text-rose-400 border border-rose-500/20 animate-pulse"
                          : "bg-emerald-500/10 text-emerald-400"
                      }`}
                    >
                      {match.status === "live" || (match.status === "scheduled" && new Date(match.kickoff_time) <= now) ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping mr-1 shrink-0" />
                      ) : match.status === "scheduled" ? (
                        <Clock className="w-3 h-3 mr-1 shrink-0 text-emerald-400" />
                      ) : null}
                      {getCountdownString(match.kickoff_time, match.status)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between px-2 py-1">
                    {/* Equipo A */}
                    <div className="flex items-center gap-2.5 w-5/12">
                      <span className="flex shrink-0 animate-fade-in" title={match.team_a}>
                        {getFlag(match.team_a)}
                      </span>
                      <span className="font-bold text-sm text-slate-200 truncate">{match.team_a}</span>
                    </div>

                    {/* Marcador */}
                    <div className="flex items-center justify-center gap-1.5 w-2/12">
                      {match.status === "finished" || match.score_a !== null ? (
                        <span className="text-base font-black text-slate-100 bg-slate-950/60 px-2.5 py-0.5 rounded border border-white/5">
                          {match.score_a} - {match.score_b}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-600 font-bold uppercase tracking-wider">VS</span>
                      )}
                    </div>

                    {/* Equipo B */}
                    <div className="flex items-center gap-2.5 w-5/12 justify-end text-right">
                      <span className="font-bold text-sm text-slate-200 truncate">{match.team_b}</span>
                      <span className="flex shrink-0 animate-fade-in" title={match.team_b}>
                        {getFlag(match.team_b)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-white/5 text-[11px] text-slate-500 flex justify-between">
                    <span>Kickoff: {formatToBoliviaTime(match.kickoff_time)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Columna 2: Apostar & Simulador (lg:col-span-4) */}
        <section className="lg:col-span-4 space-y-6">
          {selectedMatch && (
            <>
              {/* Formulario de Apuestas */}
              <div className="glass-panel p-6 relative overflow-hidden" id="bet-form-panel">
                <div className="shimmer-effect absolute inset-0 pointer-events-none" />
                <h2 className="text-lg font-extrabold text-slate-200 mb-4 flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-emerald-400" /> Registrar Apuesta
                </h2>

                <form onSubmit={handlePlaceBet} className="space-y-4">
                  {/* Vista del partido seleccionado */}
                  <div className="bg-slate-950/40 rounded-xl p-3.5 border border-white/5 flex flex-col items-center">
                    <div className="text-[10px] text-slate-500 font-semibold mb-2">PARTIDO SELECCIONADO</div>
                    <div className="flex items-center gap-3 justify-center w-full">
                      <span className="flex shrink-0">{getFlag(selectedMatch.team_a)}</span>
                      <span className="text-sm font-bold text-slate-200 truncate max-w-[80px]" title={selectedMatch.team_a}>{selectedMatch.team_a}</span>
                      <span className="text-xs font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 shrink-0">VS</span>
                      <span className="text-sm font-bold text-slate-200 truncate max-w-[80px]" title={selectedMatch.team_b}>{selectedMatch.team_b}</span>
                      <span className="flex shrink-0">{getFlag(selectedMatch.team_b)}</span>
                    </div>
                  </div>

                  {/* Nombre participante */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="participant-name-input" className="text-xs font-semibold text-slate-300">
                      Tu Nombre / Apodo
                    </label>
                    <input
                      id="participant-name-input"
                      type="text"
                      placeholder="Ej. Juan Perez, Crack99"
                      value={participantName}
                      onChange={(e) => setParticipantName(e.target.value)}
                      disabled={isPendingBet}
                      className="glass-input text-sm"
                    />
                  </div>

                  {/* Marcador pronosticado */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-300">Pronóstico del Marcador</label>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Goles Equipo A */}
                      <div className="flex flex-col items-center gap-1 bg-slate-900/30 p-2.5 rounded-lg border border-white/5">
                        <label htmlFor="pred-score-a" className="text-[10px] text-slate-500 truncate max-w-full">
                          Goles {selectedMatch.team_a}
                        </label>
                        <input
                          id="pred-score-a"
                          type="number"
                          min="0"
                          value={predScoreA}
                          onChange={(e) => setPredScoreA(e.target.value)}
                          disabled={isPendingBet}
                          className="glass-input text-center text-lg font-bold w-full p-2"
                        />
                      </div>
                      
                      {/* Goles Equipo B */}
                      <div className="flex flex-col items-center gap-1 bg-slate-900/30 p-2.5 rounded-lg border border-white/5">
                        <label htmlFor="pred-score-b" className="text-[10px] text-slate-500 truncate max-w-full">
                          Goles {selectedMatch.team_b}
                        </label>
                        <input
                          id="pred-score-b"
                          type="number"
                          min="0"
                          value={predScoreB}
                          onChange={(e) => setPredScoreB(e.target.value)}
                          disabled={isPendingBet}
                          className="glass-input text-center text-lg font-bold w-full p-2"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Monto de apuesta */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="bet-amount-input" className="text-xs font-semibold text-slate-300">
                      Monto de Apuesta (Bs.)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400 font-bold text-xs select-none">Bs.</span>
                      <input
                        id="bet-amount-input"
                        type="number"
                        min="1"
                        step="1"
                        placeholder="10"
                        value={betAmount}
                        onChange={(e) => setBetAmount(e.target.value)}
                        disabled={isPendingBet}
                        className="glass-input pl-12 w-full text-sm font-semibold"
                      />
                    </div>
                  </div>

                  {betError && (
                    <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{betError}</span>
                    </div>
                  )}

                  {betSuccess && (
                    <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-xs font-medium flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>¡Apuesta registrada con éxito!</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isPendingBet}
                    className="btn-green w-full mt-4 cursor-pointer text-sm py-3.5 flex items-center justify-center gap-2"
                    id="btn-bet-submit"
                  >
                    {isPendingBet ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Procesando apuesta...
                      </>
                    ) : (
                      "Registrar Apuesta"
                    )}
                  </button>
                </form>
              </div>

              {/* Panel de Simulación / Modo Administrador */}
              {isAdminMode && (
                <div className="glass-panel p-6 border-dashed border-amber-500/40 relative overflow-hidden" id="simulator-panel">
                  <h2 className="text-lg font-extrabold text-amber-400 mb-3 flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-amber-400 shrink-0" /> Actualizar Score Real
                  </h2>
                  <p className="text-xs text-slate-400 mb-4">
                    Introduce el marcador oficial del partido. Al guardar, todas las apuestas de este partido se evaluarán automáticamente.
                  </p>

                  <form onSubmit={handleSimulateScore} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      {/* Score real A */}
                      <div className="flex flex-col gap-1">
                        <label htmlFor="sim-score-a" className="text-[10px] text-slate-400 truncate">
                          Score {selectedMatch.team_a}
                        </label>
                        <input
                          id="sim-score-a"
                          type="number"
                          min="0"
                          placeholder="-"
                          value={simScoreA}
                          onChange={(e) => setSimScoreA(e.target.value)}
                          disabled={isPendingSim}
                          className="glass-input text-center text-lg font-bold w-full bg-slate-950/50 p-2"
                        />
                      </div>

                      {/* Score real B */}
                      <div className="flex flex-col gap-1">
                        <label htmlFor="sim-score-b" className="text-[10px] text-slate-400 truncate">
                          Score {selectedMatch.team_b}
                        </label>
                        <input
                          id="sim-score-b"
                          type="number"
                          min="0"
                          placeholder="-"
                          value={simScoreB}
                          onChange={(e) => setSimScoreB(e.target.value)}
                          disabled={isPendingSim}
                          className="glass-input text-center text-lg font-bold w-full bg-slate-950/50 p-2"
                        />
                      </div>
                    </div>

                    {simError && (
                      <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{simError}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 mt-4">
                      <button
                        type="button"
                        onClick={handleResetMatch}
                        disabled={isPendingSim || (selectedMatch.score_a === null)}
                        className="btn-outline text-xs py-2.5 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Reiniciar
                      </button>
                      <button
                        type="submit"
                        disabled={isPendingSim}
                        className="btn-gold text-xs py-2.5 cursor-pointer flex items-center justify-center gap-1.5"
                        id="btn-sim-submit"
                      >
                        {isPendingSim ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando...
                          </>
                        ) : (
                          "Guardar Score"
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </>
          )}
        </section>

        {/* Columna 3: Tabla de Posiciones (lg:col-span-4) */}
        <section className="lg:col-span-4 space-y-4" id="section-leaderboard">
          <h2 className="text-lg font-extrabold text-slate-200 px-1">Clasificación del Grupo</h2>

          <div className="glass-panel p-5 overflow-hidden">
            {leaderboard.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                Aún no hay apuestas registradas en este grupo. ¡Sé el primero en apostar!
              </div>
            ) : (
              <div className="space-y-3.5 max-h-[480px] overflow-y-auto pr-1">
                {leaderboard.map((user, index) => {
                  const isTop = index === 0;
                  const isSecond = index === 1;
                  const isThird = index === 2;

                  return (
                    <div
                      key={user.name}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-950/30 border border-white/5 relative"
                    >
                      <div className="flex items-center gap-3 w-8/12">
                        {/* Medalla / Posición */}
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black border ${
                            isTop
                              ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                              : isSecond
                              ? "bg-slate-300/10 text-slate-300 border-slate-300/20"
                              : isThird
                              ? "bg-amber-700/10 text-amber-600 border-amber-700/20"
                              : "bg-slate-900 text-slate-400 border-white/5"
                          }`}
                        >
                          {index + 1}
                        </div>
                        <div className="truncate">
                          <p className="font-bold text-sm text-slate-200 truncate">{user.name}</p>
                          <p className="text-[10px] text-slate-500 truncate">
                            {user.totalBets} {user.totalBets === 1 ? "apuesta" : "apuestas"} • {user.totalAmount} Bs.
                          </p>
                        </div>
                      </div>

                      <div className="text-right w-4/12">
                        <span className="text-base font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                          {user.points} pts
                        </span>
                        <div className="text-[9px] text-slate-500 mt-1.5">
                          Exactos: {user.exact} | Resultados: {user.outcome}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

      </div>

      {/* Tabla Inferior: Historial de Apuestas */}
      <section className="glass-panel p-6 z-10 overflow-hidden" id="section-bets-history">
        <h2 className="text-lg font-extrabold text-slate-200 mb-4 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-emerald-400" /> Historial de Apuestas
        </h2>

        {bets.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            No se han registrado apuestas en este grupo todavía.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Participante</th>
                  <th>Partido</th>
                  <th>Pronóstico</th>
                  <th>Score Real</th>
                  <th>Monto</th>
                  <th>Fecha Apuesta (BO)</th>
                  <th>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {bets.map((bet) => {
                  const evaluation = evaluateBet(bet);
                  return (
                    <tr key={bet.id}>
                      <td className="font-bold text-slate-200">{bet.participant_name}</td>
                      <td>
                        {bet.matches ? (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="flex shrink-0">{getFlag(bet.matches.team_a)}</span>
                            <span className="font-semibold text-slate-200">{bet.matches.team_a}</span>
                            <span className="text-slate-500">vs</span>
                            <span className="font-semibold text-slate-200">{bet.matches.team_b}</span>
                            <span className="flex shrink-0">{getFlag(bet.matches.team_b)}</span>
                          </div>
                        ) : (
                          "Partido no disponible"
                        )}
                      </td>
                      <td className="font-mono text-slate-200 text-sm font-semibold">
                        {bet.predicted_score_a} - {bet.predicted_score_b}
                      </td>
                      <td className="font-mono text-slate-400 text-sm">
                        {bet.matches && bet.matches.score_a !== null && bet.matches.score_b !== null
                          ? `${bet.matches.score_a} - ${bet.matches.score_b}`
                          : "-"}
                      </td>
                      <td className="font-bold text-emerald-400">{Number(bet.amount)} Bs.</td>
                      <td className="text-xs text-slate-400 font-light">
                        {formatToBoliviaTime(bet.created_at)}
                      </td>
                      <td>
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs border font-medium ${evaluation.badgeClass}`}>
                          {evaluation.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="mt-12 text-center text-xs text-slate-600 py-6 border-t border-white/5">
        <p>Copa Mundial de Fútbol 2026 | Desarrollado con Next.js y Supabase</p>
        <p className="mt-1">Reloj sincronizado con la Zona Horaria de Bolivia (UTC-4).</p>
      </footer>
    </div>
  );
}
