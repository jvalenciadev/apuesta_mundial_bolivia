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
  TrendingUp,
  ArrowRight,
  Star,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
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
  rollover_pool: number;
  prize_distributed: boolean;
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
  prize_won: number;
  result_status: "pending" | "exact" | "winner" | "loser";
  matches: {
    team_a: string;
    team_b: string;
    score_a: number | null;
    score_b: number | null;
    status: "scheduled" | "live" | "finished";
    rollover_pool: number;
  } | null;
}

interface GroupDashboardProps {
  group: Group;
  initialMatches: Match[];
  initialBets: Bet[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getFlag(team: string): React.JSX.Element {
  return getFlagSVG(team);
}

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
  } catch {
    return dateString;
  }
}

type BetEvaluation = {
  label: string;
  badgeClass: string;
  points: number;
  status: string;
};

function evaluateBetDisplay(bet: Bet): BetEvaluation {
  switch (bet.result_status) {
    case "pending":
      return {
        label: "Pendiente",
        badgeClass: "bg-slate-500/10 text-slate-400 border-slate-500/20",
        points: 0,
        status: "pending",
      };
    case "exact":
      return {
        label: "Exacto +3 pts",
        badgeClass:
          "bg-amber-500/20 text-amber-400 border-amber-500/30 font-semibold shadow-[0_0_10px_rgba(251,191,36,0.15)]",
        points: 3,
        status: "exact",
      };
    case "winner":
      return {
        label: "Ganador +3 pts",
        badgeClass: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
        points: 3,
        status: "winner",
      };
    case "loser":
      return {
        label: "Perdedor +1 pt",
        badgeClass: "bg-rose-500/10 text-rose-400/70 border-rose-500/10",
        points: 1,
        status: "loser",
      };
    default:
      return {
        label: "Pendiente",
        badgeClass: "bg-slate-500/10 text-slate-400 border-slate-500/20",
        points: 0,
        status: "pending",
      };
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
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

  const [participantName, setParticipantName] = useState("");
  const [predScoreA, setPredScoreA] = useState("0");
  const [predScoreB, setPredScoreB] = useState("0");
  const [betAmount, setBetAmount] = useState("10");
  const [betError, setBetError] = useState("");
  const [betSuccess, setBetSuccess] = useState(false);
  const [toastExiting, setToastExiting] = useState(false);
  const [isPendingBet, startBetTransition] = useTransition();

  const [isAdminMode, setIsAdminMode] = useState(false);
  const [simScoreA, setSimScoreA] = useState("0");
  const [simScoreB, setSimScoreB] = useState("0");
  const [simError, setSimError] = useState("");
  const [isPendingSim, startSimTransition] = useTransition();

  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(new Date());

  // -----------------------------------------------------------------------
  // Realtime subscriptions
  // -----------------------------------------------------------------------
  useEffect(() => {
    const supabase = createClient();

    const savedName = localStorage.getItem("polla_participant_name");
    if (savedName) setParticipantName(savedName);

    const matchesChannel = supabase
      .channel("realtime-matches")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches" },
        async () => {
          const { data: updatedMatches } = await supabase
            .from("matches")
            .select(
              "id, team_a, team_b, kickoff_time, score_a, score_b, status, group_stage, rollover_pool, prize_distributed"
            )
            .order("kickoff_time", { ascending: true });
          if (updatedMatches) {
            setMatches(updatedMatches as Match[]);
            if (selectedMatch) {
              const cur = updatedMatches.find((m) => m.id === selectedMatch.id);
              if (cur) setSelectedMatch(cur as Match);
            }
          }
        }
      )
      .subscribe();

    const betsChannel = supabase
      .channel("realtime-bets")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bets" },
        async () => {
          const { data: updatedBets } = await supabase
            .from("bets")
            .select(`
              id,
              participant_name,
              predicted_score_a,
              predicted_score_b,
              amount,
              prize_won,
              created_at,
              match_id,
              points_won,
              result_status,
              matches (
                team_a,
                team_b,
                score_a,
                score_b,
                status,
                rollover_pool
              )
            `)
            .eq("group_id", group.id)
            .order("created_at", { ascending: false });

          if (updatedBets) {
            const mapped = updatedBets.map((b: any) => ({
              ...b,
              matches: Array.isArray(b.matches) ? b.matches[0] : b.matches ?? null,
            })) as Bet[];
            setBets(mapped);
          }
        }
      )
      .subscribe();

    const timer = setInterval(() => setNow(new Date()), 1000);

    return () => {
      supabase.removeChannel(matchesChannel);
      supabase.removeChannel(betsChannel);
      clearInterval(timer);
    };
  }, [group.id, selectedMatch]);

  useEffect(() => {
    if (selectedMatch) {
      setSimScoreA(selectedMatch.score_a !== null ? String(selectedMatch.score_a) : "0");
      setSimScoreB(selectedMatch.score_b !== null ? String(selectedMatch.score_b) : "0");
    }
  }, [selectedMatch]);

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------
  const handleCopyCode = () => {
    navigator.clipboard.writeText(group.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePlaceBet = (e: React.FormEvent) => {
    e.preventDefault();
    setBetError("");
    setBetSuccess(false);

    if (!selectedMatch) {
      setBetError("Selecciona un partido para apostar.");
      return;
    }
    if (selectedMatch.status === "finished") {
      setBetError("No puedes apostar en un partido ya finalizado.");
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

    localStorage.setItem("polla_participant_name", participantName.trim());

    startBetTransition(async () => {
      const res = await placeBet(group.id, selectedMatch.id, participantName, pA, pB, amt);
      if (res.success) {
        setBetSuccess(true);
        setToastExiting(false);
        setPredScoreA("0");
        setPredScoreB("0");
        // Iniciar salida del toast después de 3s
        setTimeout(() => setToastExiting(true), 3000);
        setTimeout(() => setBetSuccess(false), 3400);
      } else {
        setBetError(res.error || "Error al registrar la apuesta.");
      }
    });
  };

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
      if (!res.success) setSimError(res.error || "Error al actualizar el marcador.");
    });
  };

  const handleResetMatch = () => {
    startSimTransition(async () => {
      const res = await updateMatchScore(group.id, selectedMatch!.id, null, null);
      if (!res.success) setSimError(res.error || "Error al reiniciar el partido.");
    });
  };

  const getCountdownString = (kickoffTimeStr: string, matchStatus: string) => {
    if (matchStatus === "finished") return "Finalizado";
    const kickoff = new Date(kickoffTimeStr);
    const diff = kickoff.getTime() - now.getTime();
    if (diff <= 0) return "En Vivo";

    const secs = Math.floor(diff / 1000);
    const mins = Math.floor(secs / 60);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    return `${String(hours).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
  };

  // --- Derived stats ---
  const totalPool = bets.reduce((acc, b) => acc + (Number(b.amount) || 0), 0);
  const totalBets = bets.length;

  // Pozo actual del partido seleccionado (apuestas de ese partido + rollover)
  const matchBets = selectedMatch
    ? bets.filter((b) => b.match_id === selectedMatch.id)
    : [];
  const matchBetPool = matchBets.reduce((acc, b) => acc + (Number(b.amount) || 0), 0);
  const matchTotalPool = matchBetPool + (Number(selectedMatch?.rollover_pool) || 0);

  // Rollover total acumulado en partidos futuros
  const totalRollover = matches.reduce((acc, m) => acc + (Number(m.rollover_pool) || 0), 0);

  // Premio total distribuido (suma de prize_won)
  const totalPrizeDistributed = bets.reduce((acc, b) => acc + (Number(b.prize_won) || 0), 0);
  const hasDistributedPrizes = totalPrizeDistributed > 0;

  // Clasificación por premios ganados (Bs.), con puntos como desempate
  type ParticipantStat = {
    name: string;
    points: number;
    prizeWon: number;
    totalBets: number;
    totalAmount: number;
    wins: number; // exacto + winner
    losses: number;
  };

  const participantMap: Record<string, ParticipantStat> = {};

  bets.forEach((bet) => {
    const name = bet.participant_name;
    if (!participantMap[name]) {
      participantMap[name] = {
        name,
        points: 0,
        prizeWon: 0,
        totalBets: 0,
        totalAmount: 0,
        wins: 0,
        losses: 0,
      };
    }

    const ev = evaluateBetDisplay(bet);
    participantMap[name].points += ev.points;
    participantMap[name].prizeWon += Number(bet.prize_won) || 0;
    participantMap[name].totalBets += 1;
    participantMap[name].totalAmount += Number(bet.amount) || 0;
    if (ev.status === "exact" || ev.status === "winner") participantMap[name].wins += 1;
    if (ev.status === "loser") participantMap[name].losses += 1;
  });

  const leaderboard = Object.values(participantMap).sort((a, b) => {
    // Primero por Bs. ganados
    if (b.prizeWon !== a.prizeWon) return b.prizeWon - a.prizeWon;
    // Desempate por puntos
    if (b.points !== a.points) return b.points - a.points;
    // Desempate por victorias
    return b.wins - a.wins;
  });

  const currentLeader = leaderboard.length > 0 ? leaderboard[0].name : "Ninguno aún";

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 max-w-7xl mx-auto w-full relative">
      {/* Toast flotante - éxito apuesta */}
      {betSuccess && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl bg-emerald-950/90 border border-emerald-500/40 shadow-[0_8px_32px_rgba(16,185,129,0.25)] backdrop-blur-md ${
            toastExiting ? "toast-exit" : "toast-enter"
          }`}
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <p className="text-sm font-bold text-emerald-300">¡Apuesta registrada!</p>
            <p className="text-xs text-emerald-500 mt-0.5">Tu pronóstico fue guardado correctamente.</p>
          </div>
        </div>
      )}
      {/* Luces decorativas */}
      <div className="absolute top-10 left-1/4 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 z-10">
        <div>
          <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full uppercase">
            Grupo Privado
          </span>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-100 mt-2 flex items-center gap-2">
            <Trophy className="w-8 h-8 text-amber-400 shrink-0" /> {group.name}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-slate-900/60 border border-white/10 rounded-lg p-2.5 text-sm w-full md:w-auto justify-between">
            <span className="text-slate-400">Código:</span>
            <code className="text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/25">
              {group.code}
            </code>
            <button
              onClick={handleCopyCode}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded border border-white/10 transition cursor-pointer"
            >
              {copied ? (
                <span className="flex items-center gap-1">Copiado <Check className="w-3.5 h-3.5" /></span>
              ) : (
                <span className="flex items-center gap-1">Copiar <Copy className="w-3.5 h-3.5" /></span>
              )}
            </button>
          </div>

          <button
            onClick={() => leaveGroup(group.id)}
            className="btn-outline text-xs px-4 py-2.5 cursor-pointer w-full md:w-auto"
          >
            <span className="flex items-center gap-1.5">
              <LogOut className="w-4 h-4" /> Salir
            </span>
          </button>
        </div>
      </header>

      {/* Stats rápidas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8 z-10">
        <div className="glass-panel p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Pozo Total</p>
            <h3 className="text-2xl font-black text-emerald-400 mt-1">
              {totalPool.toFixed(0)} <span className="text-xs font-normal text-slate-400">Bs.</span>
            </h3>
          </div>
          <span className="bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20 text-emerald-400">
            <Coins className="w-5 h-5" />
          </span>
        </div>

        <div className="glass-panel p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Rollover</p>
            <h3 className="text-2xl font-black text-rose-400 mt-1">
              {totalRollover.toFixed(0)} <span className="text-xs font-normal text-slate-400">Bs.</span>
            </h3>
          </div>
          <span className="bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20 text-rose-400">
            <ArrowRight className="w-5 h-5" />
          </span>
        </div>

        <div className="glass-panel p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Apuestas</p>
            <h3 className="text-2xl font-black text-amber-400 mt-1">{totalBets}</h3>
          </div>
          <span className="bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 text-amber-400">
            <Ticket className="w-5 h-5" />
          </span>
        </div>

        <div className="glass-panel p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Líder</p>
            <h3 className="text-sm font-bold text-slate-100 truncate max-w-[110px] mt-1 flex items-center gap-1">
              <Medal className="w-3.5 h-3.5 text-amber-400 shrink-0" /> {currentLeader}
            </h3>
          </div>
          <span className="bg-blue-500/10 p-2.5 rounded-xl border border-blue-500/20 text-amber-400">
            <Trophy className="w-5 h-5" />
          </span>
        </div>
      </div>

      {/* Simulador toggle */}
      <div className="glass-panel p-4 mb-8 z-10 flex items-center justify-between border-dashed border-emerald-500/30">
        <div className="flex items-center gap-3">
          <Wrench className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <h4 className="text-sm font-bold text-slate-200">Simulador de Resultados</h4>
            <p className="text-xs text-slate-400">
              Actualiza marcadores reales y dispara la distribución automática del pozo.
            </p>
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
            "Desactivar"
          ) : (
            <span className="flex items-center gap-1.5">
              Activar <Sparkles className="w-3.5 h-3.5" />
            </span>
          )}
        </button>
      </div>

      {/* Grid principal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8 z-10 items-start">

        {/* Columna 1: Partidos */}
        <section className="lg:col-span-4 space-y-4" id="section-matches-list">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-lg font-extrabold text-slate-200">Partidos del Mundial</h2>
            <span className="text-[10px] text-slate-500 uppercase">Hora Bolivia (UTC-4)</span>
          </div>

          <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
            {matches.map((match) => {
              const isSelected = selectedMatch?.id === match.id;
              const hasRollover = Number(match.rollover_pool) > 0;
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
                      className={`px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${
                        match.status === "finished"
                          ? "bg-slate-800 text-slate-400"
                          : match.status === "live" || new Date(match.kickoff_time) <= now
                          ? "bg-rose-500/20 text-rose-400 border border-rose-500/20 animate-pulse"
                          : "bg-emerald-500/10 text-emerald-400"
                      }`}
                    >
                      {match.status === "live" ||
                      (match.status === "scheduled" && new Date(match.kickoff_time) <= now) ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping shrink-0" />
                      ) : match.status === "scheduled" ? (
                        <Clock className="w-3 h-3 shrink-0 text-emerald-400" />
                      ) : null}
                      {getCountdownString(match.kickoff_time, match.status)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between px-2 py-1">
                    <div className="flex items-center gap-2 w-5/12">
                      <span className="flex shrink-0">{getFlag(match.team_a)}</span>
                      <span className="font-bold text-sm text-slate-200 truncate">{match.team_a}</span>
                    </div>

                    <div className="flex items-center justify-center gap-1.5 w-2/12">
                      {match.score_a !== null ? (
                        <span className="text-base font-black text-slate-100 bg-slate-950/60 px-2.5 py-0.5 rounded border border-white/5">
                          {match.score_a} - {match.score_b}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-600 font-bold uppercase tracking-wider">VS</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 w-5/12 justify-end text-right">
                      <span className="font-bold text-sm text-slate-200 truncate">{match.team_b}</span>
                      <span className="flex shrink-0">{getFlag(match.team_b)}</span>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-white/5 text-[11px] text-slate-500 flex justify-between items-center">
                    <span>{formatToBoliviaTime(match.kickoff_time)}</span>
                    {hasRollover && (
                      <span className="text-rose-400 font-semibold flex items-center gap-1">
                        <ArrowRight className="w-3 h-3" />
                        Rollover {Number(match.rollover_pool).toFixed(0)} Bs.
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Columna 2: Apostar + Simulador */}
        <section className="lg:col-span-4 space-y-6">
          {selectedMatch && (
            <>
              {/* Panel: Pozo del Partido */}
              <div className="glass-panel p-4 flex items-center justify-between bg-gradient-to-r from-emerald-950/30 to-transparent border-emerald-500/20">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                    Pozo del Partido
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedMatch.team_a} vs {selectedMatch.team_b}
                  </p>
                  {Number(selectedMatch.rollover_pool) > 0 && (
                    <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1">
                      <ArrowRight className="w-3 h-3" />
                      Rollover incluido: {Number(selectedMatch.rollover_pool).toFixed(0)} Bs.
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-emerald-400">
                    {matchTotalPool.toFixed(0)}
                  </span>
                  <span className="text-xs text-slate-400 ml-1">Bs.</span>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {matchBets.length} apostador{matchBets.length !== 1 ? "es" : ""}
                  </p>
                </div>
              </div>

              {/* Formulario de Apuesta */}
              <div className="glass-panel p-6 relative overflow-hidden" id="bet-form-panel">
                <div className="shimmer-effect absolute inset-0 pointer-events-none" />
                <h2 className="text-lg font-extrabold text-slate-200 mb-4 flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-emerald-400" /> Registrar Apuesta
                </h2>

                {selectedMatch.status === "finished" && (
                  <div className="mb-4 p-3 rounded-xl bg-slate-800/60 border border-white/10 text-slate-400 text-xs text-center">
                    Este partido ya finalizó. No se aceptan más apuestas.
                  </div>
                )}

                <form onSubmit={handlePlaceBet} className="space-y-4">
                  {/* Partido seleccionado */}
                  <div className="bg-slate-950/40 rounded-xl p-3.5 border border-white/5 flex flex-col items-center">
                    <div className="text-[10px] text-slate-500 font-semibold mb-2">PARTIDO SELECCIONADO</div>
                    <div className="flex items-center gap-3 justify-center w-full">
                      <span className="flex shrink-0">{getFlag(selectedMatch.team_a)}</span>
                      <span className="text-sm font-bold text-slate-200 truncate max-w-[80px]">
                        {selectedMatch.team_a}
                      </span>
                      <span className="text-xs font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 shrink-0">
                        VS
                      </span>
                      <span className="text-sm font-bold text-slate-200 truncate max-w-[80px]">
                        {selectedMatch.team_b}
                      </span>
                      <span className="flex shrink-0">{getFlag(selectedMatch.team_b)}</span>
                    </div>
                  </div>

                  {/* Nombre */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="participant-name-input" className="text-xs font-semibold text-slate-300">
                      Tu Nombre / Apodo
                    </label>
                    <input
                      id="participant-name-input"
                      type="text"
                      placeholder="Ej. Juan, Crack99"
                      value={participantName}
                      onChange={(e) => setParticipantName(e.target.value)}
                      disabled={isPendingBet || selectedMatch.status === "finished"}
                      className="glass-input text-sm"
                    />
                  </div>

                  {/* Pronóstico */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-300">Pronóstico del Marcador</label>
                    <div className="grid grid-cols-2 gap-4">
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
                          disabled={isPendingBet || selectedMatch.status === "finished"}
                          className="glass-input text-center text-lg font-bold w-full p-2"
                        />
                      </div>
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
                          disabled={isPendingBet || selectedMatch.status === "finished"}
                          className="glass-input text-center text-lg font-bold w-full p-2"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Monto */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="bet-amount-input" className="text-xs font-semibold text-slate-300">
                      Monto de Apuesta (Bs.)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400 font-bold text-xs select-none pointer-events-none">
                        Bs.
                      </span>
                      <input
                        id="bet-amount-input"
                        type="number"
                        min="1"
                        step="1"
                        placeholder="10"
                        value={betAmount}
                        onChange={(e) => setBetAmount(e.target.value)}
                        disabled={isPendingBet || selectedMatch.status === "finished"}
                        className="glass-input-prefix text-sm font-semibold"
                      />
                    </div>
                  </div>

                  {betError && (
                    <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{betError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isPendingBet || selectedMatch.status === "finished"}
                    className="btn-green w-full mt-4 cursor-pointer text-sm py-3.5 flex items-center justify-center gap-2 disabled:opacity-50"
                    id="btn-bet-submit"
                  >
                    {isPendingBet ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Procesando...
                      </>
                    ) : (
                      "Registrar Apuesta"
                    )}
                  </button>
                </form>
              </div>

              {/* Panel Simulador */}
              {isAdminMode && (
                <div className="glass-panel p-6 border-dashed border-amber-500/40" id="simulator-panel">
                  <h2 className="text-lg font-extrabold text-amber-400 mb-1 flex items-center gap-2">
                    <Wrench className="w-5 h-5 shrink-0" /> Score Real
                  </h2>
                  <p className="text-xs text-slate-400 mb-4">
                    Al guardar, se distribuye el pozo automáticamente entre los ganadores.
                    Si nadie acierta, el pozo pasa al siguiente partido.
                  </p>

                  <form onSubmit={handleSimulateScore} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1">
                        <label htmlFor="sim-score-a" className="text-[10px] text-slate-400 truncate">
                          {selectedMatch.team_a}
                        </label>
                        <input
                          id="sim-score-a"
                          type="number"
                          min="0"
                          value={simScoreA}
                          onChange={(e) => setSimScoreA(e.target.value)}
                          disabled={isPendingSim}
                          className="glass-input text-center text-lg font-bold w-full p-2"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label htmlFor="sim-score-b" className="text-[10px] text-slate-400 truncate">
                          {selectedMatch.team_b}
                        </label>
                        <input
                          id="sim-score-b"
                          type="number"
                          min="0"
                          value={simScoreB}
                          onChange={(e) => setSimScoreB(e.target.value)}
                          disabled={isPendingSim}
                          className="glass-input text-center text-lg font-bold w-full p-2"
                        />
                      </div>
                    </div>

                    {simError && (
                      <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{simError}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handleResetMatch}
                        disabled={isPendingSim || selectedMatch.score_a === null}
                        className="btn-outline text-xs py-2.5 cursor-pointer disabled:opacity-40 flex items-center justify-center gap-1.5"
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
                          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando...</>
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

        {/* Columna 3: Clasificación */}
        <section className="lg:col-span-4 space-y-4" id="section-leaderboard">
          <h2 className="text-lg font-extrabold text-slate-200 px-1">Clasificación</h2>
          <div className="glass-panel p-5 overflow-hidden">
            {/* Leyenda de puntos */}
            <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-white/5">
              <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-full">
                <Star className="w-2.5 h-2.5" /> Exacto = 3 pts
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-full">
                <TrendingUp className="w-2.5 h-2.5" /> Ganador = 3 pts
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] text-rose-400 bg-rose-500/10 border border-rose-500/10 px-2 py-1 rounded-full">
                Perdedor = 1 pt
              </span>
            </div>

            {leaderboard.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                Sin apuestas registradas. ¡Sé el primero!
              </div>
            ) : (
              <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                {leaderboard.map((user, index) => {
                  const isTop = index === 0;
                  const isSecond = index === 1;
                  const isThird = index === 2;

                  return (
                    <div
                      key={user.name}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-950/30 border border-white/5"
                    >
                      <div className="flex items-center gap-3 w-7/12">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black border shrink-0 ${
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
                        <div className="truncate min-w-0">
                          <p className="font-bold text-sm text-slate-200 truncate">{user.name}</p>
                          <p className="text-[10px] text-slate-500">
                            {user.wins}G / {user.losses}P &bull; apostado: {user.totalAmount.toFixed(0)} Bs.
                          </p>
                        </div>
                      </div>

                      <div className="text-right w-5/12 flex flex-col items-end gap-1">
                        {/* Pts siempre visible */}
                        <span className={`text-sm font-black px-2.5 py-1 rounded-lg border ${
                          user.points > 0
                            ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                            : "text-slate-500 bg-slate-800/40 border-white/5"
                        }`}>
                          {user.points} pts
                        </span>
                        {/* Bs. ganados: solo si hay premios distribuidos */}
                        {hasDistributedPrizes && (
                          <span className={`text-[10px] font-bold ${
                            user.prizeWon > 0 ? "text-amber-400" : "text-slate-600"
                          }`}>
                            {user.prizeWon > 0 ? `+${user.prizeWon.toFixed(0)} Bs.` : "Sin premio"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Historial de Apuestas */}
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
                  <th>Apostado</th>
                  <th>Premio</th>
                  <th>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {bets.map((bet) => {
                  const ev = evaluateBetDisplay(bet);
                  const prize = Number(bet.prize_won ?? 0);
                  return (
                    <tr key={bet.id}>
                      <td className="font-bold text-slate-200">{bet.participant_name}</td>
                      <td>
                        {bet.matches ? (
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="flex shrink-0">{getFlag(bet.matches.team_a)}</span>
                            <span className="font-semibold text-slate-200">{bet.matches.team_a}</span>
                            <span className="text-slate-500">vs</span>
                            <span className="font-semibold text-slate-200">{bet.matches.team_b}</span>
                            <span className="flex shrink-0">{getFlag(bet.matches.team_b)}</span>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="font-mono text-slate-200 text-sm font-semibold">
                        {bet.predicted_score_a} - {bet.predicted_score_b}
                      </td>
                      <td className="font-mono text-slate-400 text-sm">
                        {bet.matches?.score_a !== null && bet.matches?.score_b !== null
                          ? `${bet.matches?.score_a} - ${bet.matches?.score_b}`
                          : "—"}
                      </td>
                      <td className="text-slate-300 font-semibold text-sm">
                        {Number(bet.amount).toFixed(0)} Bs.
                      </td>
                      <td className={`font-black text-sm ${prize > 0 ? "text-emerald-400" : "text-slate-600"}`}>
                        {prize > 0 ? `+${prize.toFixed(0)} Bs.` : "—"}
                      </td>
                      <td>
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs border font-medium ${ev.badgeClass}`}>
                          {ev.label}
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
        <p className="mt-1">Zona Horaria: Bolivia (UTC-4)</p>
      </footer>
    </div>
  );
}
