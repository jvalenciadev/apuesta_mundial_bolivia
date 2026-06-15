"use client";

import { useState, useEffect, useTransition } from "react";
import { placeBet, updateMatchScore, leaveGroup } from "../../actions";
import { createClient } from "@/utils/supabase/client";
import { getFlagSVG } from "@/utils/flags";
import SimulatorPanel from "./SimulatorPanel";
import { computeGroupRollovers } from "@/utils/rollover";

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
  X,
  CalendarDays,
  ListOrdered,
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
  result_status: "pending" | "exact" | "outcome" | "fail";
  group_id?: string;
  matches?: {
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
// Componente de Badge de Estado y Cuenta Regresiva (Aislado para rendimiento)
// ---------------------------------------------------------------------------
function MatchStatusBadge({ match }: { match: Match }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!now) {
    return (
      <span className="px-2 py-0.5 rounded-full font-medium flex items-center gap-1 bg-slate-800 text-slate-400 text-xs">
        <Clock className="w-3 h-3 shrink-0" />
        --:--:--
      </span>
    );
  }

  const isLive =
    match.status === "live" ||
    (match.status === "scheduled" && new Date(match.kickoff_time) <= now);
  const isFinished = match.status === "finished";

  let badgeClass = "bg-emerald-500/10 text-emerald-400";
  if (isFinished) {
    badgeClass = "bg-slate-800 text-slate-400";
  } else if (isLive) {
    badgeClass = "bg-rose-500/20 text-rose-400 border border-rose-500/20 animate-pulse";
  }

  const getCountdownString = () => {
    if (isFinished) return "Finalizado";
    const kickoff = new Date(match.kickoff_time);
    const diff = kickoff.getTime() - now.getTime();
    if (diff <= 0) return "En Vivo";

    const secs = Math.floor(diff / 1000);
    const mins = Math.floor(secs / 60);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    return `${String(hours).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
  };

  return (
    <span className={`px-2 py-0.5 rounded-full font-medium flex items-center gap-1 text-xs ${badgeClass}`}>
      {isLive && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping shrink-0" />}
      {!isLive && !isFinished && <Clock className="w-3 h-3 shrink-0 text-emerald-400" />}
      {getCountdownString()}
    </span>
  );
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
    case "outcome":
      return {
        label: "Ganador +1 pt",
        badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        points: 1,
        status: "outcome",
      };
    case "fail":
      return {
        label: "Perdedor 0 pts",
        badgeClass: "bg-rose-500/10 text-rose-400/70 border-rose-500/10",
        points: 0,
        status: "fail",
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

function shouldShowMatch(match: Match): boolean {
  if (match.status !== "finished") return true;

  try {
    const kickoff = new Date(match.kickoff_time);
    const now = new Date();

    // Check if it started less than 6 hours ago (recently finished / live matches)
    const hoursSinceKickoff = (now.getTime() - kickoff.getTime()) / (1000 * 60 * 60);
    if (hoursSinceKickoff >= 0 && hoursSinceKickoff < 6) {
      return true;
    }

    // Check if kickoff was today in Bolivia timezone
    const formatter = new Intl.DateTimeFormat("es-BO", {
      timeZone: "America/La_Paz",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    const dateParts = formatter.formatToParts(kickoff);
    const nowParts = formatter.formatToParts(now);

    const dateYear = dateParts.find(p => p.type === 'year')?.value;
    const dateMonth = dateParts.find(p => p.type === 'month')?.value;
    const dateDay = dateParts.find(p => p.type === 'day')?.value;

    const nowYear = nowParts.find(p => p.type === 'year')?.value;
    const nowMonth = nowParts.find(p => p.type === 'month')?.value;
    const nowDay = nowParts.find(p => p.type === 'day')?.value;

    return dateYear === nowYear && dateMonth === nowMonth && dateDay === nowDay;
  } catch {
    // fallback
  }
  return false;
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
    initialMatches.find((m) => m.status !== "finished") || (initialMatches.length > 0 ? initialMatches[0] : null)
  );

  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 5000);
    return () => clearInterval(timer);
  }, []);

  const [participantName, setParticipantName] = useState("");
  const [hasSavedName, setHasSavedName] = useState(false);
  const [nameSource, setNameSource] = useState<"select" | "custom">("select");

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

  // Mobile tab navigation: 'matches' | 'bet' | 'leaderboard' | 'history'
  type MobileTab = 'matches' | 'bet' | 'leaderboard' | 'history';
  const [mobileTab, setMobileTab] = useState<MobileTab>('matches');


  // -----------------------------------------------------------------------
  // Sincronización de props del Servidor (Server Actions / revalidatePath)
  // -----------------------------------------------------------------------
  useEffect(() => {
    setMatches(initialMatches);
  }, [initialMatches]);

  useEffect(() => {
    setBets(initialBets);
  }, [initialBets]);

  // Cargar apodo guardado al montar el componente
  useEffect(() => {
    const savedName = localStorage.getItem("polla_participant_name");
    if (savedName) {
      setParticipantName(savedName);
      setHasSavedName(true);
    }
  }, []);

  // Obtener participantes registrados en el grupo
  const participantNamesMap = new Map<string, string>();
  bets.forEach((b) => {
    const trimmed = b.participant_name.trim();
    const lower = trimmed.toLowerCase();
    if (!participantNamesMap.has(lower) || (trimmed !== lower && trimmed.toUpperCase() !== trimmed)) {
      participantNamesMap.set(lower, trimmed);
    }
  });
  const existingParticipants = Array.from(participantNamesMap.values()).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );

  // Cambiar a input manual por defecto si no hay participantes registrados aún
  useEffect(() => {
    if (existingParticipants.length === 0 && !hasSavedName) {
      setNameSource("custom");
    }
  }, [existingParticipants.length, hasSavedName]);

  // -----------------------------------------------------------------------
  // Realtime subscriptions
  // -----------------------------------------------------------------------
  useEffect(() => {
    const supabase = createClient();

    const matchesChannel = supabase
      .channel("realtime-matches")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newMatch = payload.new as Match;
            setMatches((prev) => {
              const exists = prev.some((m) => m.id === newMatch.id);
              if (exists) return prev;
              return [...prev, newMatch].sort(
                (a, b) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime()
              );
            });
          } else if (payload.eventType === "UPDATE") {
            const updatedMatch = payload.new as Match;
            setMatches((prev) =>
              prev.map((m) => (m.id === updatedMatch.id ? updatedMatch : m))
            );
            setSelectedMatch((curr) => (curr?.id === updatedMatch.id ? updatedMatch : curr));
          } else if (payload.eventType === "DELETE") {
            const deletedId = payload.old.id;
            setMatches((prev) => prev.filter((m) => m.id !== deletedId));
            setSelectedMatch((curr) => (curr?.id === deletedId ? null : curr));
          }
        }
      )
      .subscribe();

    const betsChannel = supabase
      .channel("realtime-bets")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bets" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newBet = payload.new as Bet;
            if (newBet.group_id === group.id) {
              setBets((prev) => {
                const exists = prev.some((b) => b.id === newBet.id);
                if (exists) return prev;
                return [newBet, ...prev];
              });
            }
          } else if (payload.eventType === "UPDATE") {
            const updatedBet = payload.new as Bet;
            setBets((prev) =>
              prev.map((b) => (b.id === updatedBet.id ? { ...b, ...updatedBet } : b))
            );
          } else if (payload.eventType === "DELETE") {
            const deletedId = payload.old.id;
            setBets((prev) => prev.filter((b) => b.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(matchesChannel);
      supabase.removeChannel(betsChannel);
    };
  }, [group.id]);

  useEffect(() => {
    if (selectedMatch) {
      setSimScoreA(selectedMatch.score_a !== null ? String(selectedMatch.score_a) : "0");
      setSimScoreB(selectedMatch.score_b !== null ? String(selectedMatch.score_b) : "0");
    }
  }, [selectedMatch]);

  // Note: we intentionally do NOT auto-jump away from finished matches so the user
  // can access the simulator on them (admin mode) or view their results.

  // Prefilar el formulario de apuesta si el participante ya tiene una apuesta en este partido
  useEffect(() => {
    if (selectedMatch) {
      const existingBet = bets.find(
        (b) =>
          b.match_id === selectedMatch.id &&
          participantName.trim() !== "" &&
          b.participant_name.toLowerCase() === participantName.trim().toLowerCase()
      );
      if (existingBet) {
        setPredScoreA(String(existingBet.predicted_score_a));
        setPredScoreB(String(existingBet.predicted_score_b));
        setBetAmount(String(existingBet.amount));
      } else {
        setPredScoreA("0");
        setPredScoreB("0");
        setBetAmount("10");
      }
    }
  }, [selectedMatch, participantName, bets]);

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
    const kickoff = new Date(selectedMatch.kickoff_time);
    const nowTime = new Date();
    if (
      selectedMatch.status === "finished" ||
      selectedMatch.status === "live" ||
      kickoff <= nowTime
    ) {
      setBetError("No puedes apostar ni modificar apuestas en un partido que ya comenzó o finalizó.");
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

    startBetTransition(async () => {
      const res = await placeBet(group.id, selectedMatch.id, participantName, pA, pB, amt);
      if (res.success) {
        localStorage.setItem("polla_participant_name", participantName.trim());
        setHasSavedName(true);
        setBetSuccess(true);
        setToastExiting(false);

        // Actualización optimista del estado local para reflejar el cambio inmediatamente
        // sin esperar al realtime (que puede no dispararse en el mismo cliente que hace el update)
        setBets((prev) => {
          const existingIdx = prev.findIndex(
            (b) =>
              b.match_id === selectedMatch.id &&
              b.participant_name.toLowerCase() === participantName.trim().toLowerCase()
          );
          if (existingIdx >= 0) {
            // UPDATE: reemplazar la apuesta existente con los nuevos valores
            const updated = [...prev];
            updated[existingIdx] = {
              ...updated[existingIdx],
              predicted_score_a: pA,
              predicted_score_b: pB,
              amount: amt,
            };
            return updated;
          } else {
            // INSERT: agregar nueva apuesta temporal (el realtime la completará con el id real)
            return prev;
          }
        });

        if (!alreadyBet) {
          setPredScoreA("0");
          setPredScoreB("0");
        }
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



  // --- Derived stats ---
  const rollovers = computeGroupRollovers(matches, bets);

  const isMatchFinished = selectedMatch ? selectedMatch.status === "finished" : false;
  const isMatchStarted = selectedMatch
    ? (selectedMatch.status === "finished" ||
       selectedMatch.status === "live" ||
       (now ? new Date(selectedMatch.kickoff_time) <= now : false))
    : false;
  const isEditable = selectedMatch && !isMatchStarted;

  const totalPool = bets.reduce((acc, b) => acc + (Number(b.amount) || 0), 0);
  const totalBets = bets.length;

  // Pozo actual del partido seleccionado (apuestas de ese partido + rollover)
  const matchBets = selectedMatch
    ? bets.filter((b) => b.match_id === selectedMatch.id)
    : [];
  const matchBetPool = matchBets.reduce((acc, b) => acc + (Number(b.amount) || 0), 0);
  const matchRolloverData = selectedMatch ? rollovers[selectedMatch.id] : null;
  const matchTotalPool = matchBetPool + (matchRolloverData ? matchRolloverData.rolloverCarriedIn : 0);

  // Detectar si el participante actual ya apostó en este partido
  const alreadyBet = selectedMatch && participantName.trim()
    ? matchBets.some(
      (b) => b.participant_name.toLowerCase() === participantName.trim().toLowerCase()
    )
    : false;

  // Apuesta resuelta del participante actual en el partido seleccionado
  const myResolvedBet = selectedMatch && participantName.trim()
    ? matchBets.find(
      (b) =>
        b.participant_name.toLowerCase() === participantName.trim().toLowerCase() &&
        b.result_status !== "pending"
    )
    : null;

  // Rollover en juego (acumulado sólo en partidos pendientes de disputa)
  const totalRollover = matches
    .filter((m) => m.status === "scheduled")
    .reduce((acc, m) => acc + (rollovers[m.id]?.rolloverCarriedIn || 0), 0);

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
    const originalName = bet.participant_name;
    const lowerName = originalName.toLowerCase();

    if (!participantMap[lowerName]) {
      participantMap[lowerName] = {
        name: originalName,
        points: 0,
        prizeWon: 0,
        totalBets: 0,
        totalAmount: 0,
        wins: 0,
        losses: 0,
      };
    }

    const pStat = participantMap[lowerName];
    // Prefer mixed-case name over all-caps
    if (originalName !== pStat.name && originalName.toUpperCase() !== originalName) {
      pStat.name = originalName;
    }

    const ev = evaluateBetDisplay(bet);
    pStat.points += ev.points;
    pStat.prizeWon += Number(bet.prize_won) || 0;
    pStat.totalBets += 1;
    pStat.totalAmount += Number(bet.amount) || 0;
    if (ev.status === "exact" || ev.status === "outcome") pStat.wins += 1;
    if (ev.status === "fail") pStat.losses += 1;
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

  // Group bets by match_id (all bets, including finished ones)
  const activeBets = bets;

  // Group by match_id
  const betsByMatch: Record<string, Bet[]> = {};
  activeBets.forEach((bet) => {
    if (!betsByMatch[bet.match_id]) {
      betsByMatch[bet.match_id] = [];
    }
    betsByMatch[bet.match_id].push(bet);
  });

  // Sort matches by kickoff time
  const sortedMatchIds = Object.keys(betsByMatch).sort((a, b) => {
    const matchA = matches.find((m) => m.id === a);
    const matchB = matches.find((m) => m.id === b);
    if (!matchA || !matchB) return 0;
    return new Date(matchA.kickoff_time).getTime() - new Date(matchB.kickoff_time).getTime();
  });

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="h-dvh flex flex-col overflow-hidden w-full relative bg-[#090d16]">
      {/* Toast flotante - éxito apuesta */}
      {betSuccess && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl bg-emerald-950/90 border border-emerald-500/40 shadow-[0_8px_32px_rgba(16,185,129,0.25)] backdrop-blur-md ${toastExiting ? "toast-exit" : "toast-enter"
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

      {/* Contenedor principal scrollable */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8 max-w-7xl mx-auto w-full relative">
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 z-10">
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
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition border cursor-pointer ${isAdminMode
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
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-8 z-10 items-start">

        {/* Columna 1: Partidos */}
        <section
          className={`col-span-1 md:col-span-6 lg:col-span-4 space-y-4 ${mobileTab !== 'matches' ? 'hidden md:block' : ''}`}
          id="section-matches-list"
        >
          <div className="flex items-center justify-between px-1">
            <h2 className="text-lg font-extrabold text-slate-200">Partidos del Mundial</h2>
            <span className="text-[10px] text-slate-500 uppercase">Hora Bolivia (UTC-4)</span>
          </div>

          <div className="space-y-3 md:max-h-[560px] md:overflow-y-auto pr-1">
            {matches
              .filter((match) => isAdminMode || shouldShowMatch(match))
              .map((match) => {
                const isSelected = selectedMatch?.id === match.id;
                const matchRollover = rollovers[match.id]?.rolloverCarriedIn || 0;
                return (
                  <div
                    key={match.id}
                    onClick={() => { setSelectedMatch(match); setMobileTab('bet'); }}
                    className={`glass-panel p-4 cursor-pointer relative transition-all ${isSelected
                      ? "border-emerald-500/50 bg-emerald-500/5 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                      : "hover:border-white/15"
                      }`}
                  >
                    <div className="flex justify-between items-center mb-3 text-xs">
                      <span className="text-slate-500 font-semibold">{match.group_stage}</span>
                      <MatchStatusBadge match={match} />
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
                      <span suppressHydrationWarning>{formatToBoliviaTime(match.kickoff_time)}</span>
                      {matchRollover > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-full">
                          <Coins className="w-2.5 h-2.5 shrink-0" />
                          +{matchRollover.toFixed(0)} Bs. acumulado
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </section>

        {/* Columna 2: Apostar + Simulador */}
        <section
          className={`col-span-1 md:col-span-6 lg:col-span-4 space-y-6 ${mobileTab !== 'bet' ? 'hidden md:block' : ''}`}
        >
          {selectedMatch ? (
            <>
              {/* Mobile: back button to match list */}
              <button
                className="md:hidden flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition mb-4 cursor-pointer"
                onClick={() => setMobileTab('matches')}
              >
                <ArrowRight className="w-3.5 h-3.5 rotate-180 text-emerald-400" /> Ver todos los partidos
              </button>
              {/* Panel: Pozo del Partido */}
              <div className="glass-panel p-4 flex items-center justify-between bg-gradient-to-r from-emerald-950/30 to-transparent border-emerald-500/20">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                    Pozo del Partido
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedMatch.team_a} vs {selectedMatch.team_b}
                  </p>
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

                {isMatchStarted && (
                  <div className="mb-4 p-3 rounded-xl bg-slate-800/60 border border-white/10 text-slate-400 text-xs text-center">
                    {selectedMatch.status === "finished"
                      ? "Este partido ya finalizó. No se aceptan más apuestas."
                      : "Este partido ya comenzó. No se aceptan más apuestas o modificaciones."}
                  </div>
                )}

                {alreadyBet && (
                  <div className={`mb-4 p-3.5 rounded-xl text-xs flex items-center gap-2 border ${isEditable
                    ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                    : "bg-amber-500/10 border-amber-500/25 text-amber-400"
                    }`}>
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>
                      <strong>{participantName.trim()}</strong> ya tiene una apuesta registrada en este partido.
                      {isEditable && " Puedes modificar tu pronóstico o monto abajo antes de empezar."}
                    </span>
                  </div>
                )}

                {/* Resultado y ganancias del participante si la apuesta ya fue resuelta */}
                {myResolvedBet && (
                  <div className={`mb-4 rounded-xl border overflow-hidden ${myResolvedBet.result_status === "exact"
                    ? "border-amber-500/30 bg-amber-500/5"
                    : myResolvedBet.result_status === "outcome"
                      ? "border-emerald-500/25 bg-emerald-500/5"
                      : "border-rose-500/15 bg-rose-500/5"
                    }`}>
                    <div className="px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {myResolvedBet.result_status === "exact" && (
                          <Star className="w-4 h-4 text-amber-400 shrink-0" />
                        )}
                        {myResolvedBet.result_status === "outcome" && (
                          <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
                        )}
                        {myResolvedBet.result_status === "fail" && (
                          <AlertCircle className="w-4 h-4 text-rose-400/70 shrink-0" />
                        )}
                        <div>
                          <p className={`text-xs font-bold ${myResolvedBet.result_status === "exact" ? "text-amber-400"
                            : myResolvedBet.result_status === "outcome" ? "text-emerald-400"
                              : "text-rose-400/70"
                            }`}>
                            {myResolvedBet.result_status === "exact" && "¡Marcador exacto! +3 puntos"}
                            {myResolvedBet.result_status === "outcome" && "Ganador del partido +1 punto"}
                            {myResolvedBet.result_status === "fail" && "Pronóstico fallido · 0 puntos"}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Tu pronóstico: {myResolvedBet.predicted_score_a} – {myResolvedBet.predicted_score_b}
                          </p>
                        </div>
                      </div>
                      {Number(myResolvedBet.prize_won) > 0 && (
                        <div className="text-right">
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Ganaste</p>
                          <p className="text-xl font-black text-amber-400">
                            +{Number(myResolvedBet.prize_won).toFixed(0)}
                            <span className="text-xs font-normal text-slate-400 ml-1">Bs.</span>
                          </p>
                        </div>
                      )}
                    </div>
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
                    {hasSavedName ? (
                      <>
                        <label htmlFor="participant-name-input" className="text-xs font-semibold text-slate-300">
                          Tu Nombre / Apodo (Registrado)
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            id="participant-name-input"
                            type="text"
                            value={participantName}
                            disabled={true}
                            className="glass-input text-sm bg-slate-950/40 text-emerald-400 font-bold border-emerald-500/20 cursor-not-allowed flex-1"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              localStorage.removeItem("polla_participant_name");
                              setParticipantName("");
                              setHasSavedName(false);
                              if (existingParticipants.length > 0) {
                                setNameSource("select");
                              } else {
                                setNameSource("custom");
                              }
                            }}
                            className="text-[10px] text-rose-400 hover:text-rose-300 transition px-2.5 py-2 rounded bg-rose-500/10 border border-rose-500/20 cursor-pointer font-bold animate-pulse"
                          >
                            Cambiar
                          </button>
                        </div>
                      </>
                    ) : nameSource === "select" ? (
                      <>
                        <div className="flex items-center justify-between">
                          <label htmlFor="participant-name-select" className="text-xs font-semibold text-slate-300">
                            Selecciona tu Nombre / Apodo
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setNameSource("custom");
                              setParticipantName("");
                            }}
                            className="text-[10px] text-amber-400 hover:text-amber-300 transition font-semibold cursor-pointer"
                          >
                            Crear Nuevo Apodo
                          </button>
                        </div>
                        <select
                          id="participant-name-select"
                          value={participantName}
                          onChange={(e) => setParticipantName(e.target.value)}
                          disabled={isPendingBet || !isEditable}
                          className="glass-input text-sm font-semibold text-slate-200"
                        >
                          <option value="">-- Selecciona tu nombre --</option>
                          {existingParticipants.map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </select>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <label htmlFor="participant-name-input" className="text-xs font-semibold text-slate-300">
                            Tu Nombre / Apodo
                          </label>
                          {existingParticipants.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setNameSource("select");
                                setParticipantName("");
                              }}
                              className="text-[10px] text-amber-400 hover:text-amber-300 transition font-semibold cursor-pointer"
                            >
                              Seleccionar Registrado
                            </button>
                          )}
                        </div>
                        <input
                          id="participant-name-input"
                          type="text"
                          placeholder="Ej. Juan, Crack99"
                          value={participantName}
                          onChange={(e) => setParticipantName(e.target.value)}
                          disabled={isPendingBet || !isEditable}
                          className="glass-input text-sm"
                        />
                      </>
                    )}
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
                          disabled={isPendingBet || !isEditable}
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
                          disabled={isPendingBet || !isEditable}
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
                        disabled={isPendingBet || !isEditable}
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
                    disabled={
                      isPendingBet ||
                      !isEditable
                    }
                    className="btn-green w-full mt-4 cursor-pointer text-sm py-3.5 flex items-center justify-center gap-2 disabled:opacity-50"
                    id="btn-bet-submit"
                  >
                    {isPendingBet ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Procesando...
                      </>
                    ) : alreadyBet ? (
                      "Actualizar Apuesta"
                    ) : (
                      "Registrar Apuesta"
                    )}
                  </button>
                </form>
              </div>

            </>
          ) : (
            <div className="glass-panel p-6 text-center py-12 flex flex-col items-center justify-center space-y-3">
              <Ticket className="w-10 h-10 text-slate-500 animate-pulse" />
              <p className="text-slate-400 text-sm font-semibold">
                Ningún partido seleccionado
              </p>
              <p className="text-slate-500 text-xs max-w-xs mx-auto">
                Selecciona un partido de la lista para registrar tu pronóstico o ver los detalles de las apuestas.
              </p>
              <button
                className="md:hidden btn-green text-xs px-4 py-2 cursor-pointer mt-2"
                onClick={() => setMobileTab('matches')}
              >
                Ver partidos
              </button>
            </div>
          )}
        </section>

        {/* Columna 3: Clasificación */}
        <section
          className={`col-span-1 md:col-span-12 lg:col-span-4 space-y-4 ${mobileTab !== 'leaderboard' ? 'hidden md:block' : ''}`}
          id="section-leaderboard"
        >
          <h2 className="text-lg font-extrabold text-slate-200 px-1">Clasificación</h2>
          <div className="glass-panel p-5 overflow-hidden">
            {/* Leyenda de puntos */}
            <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-white/5">
              <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-full">
                <Star className="w-2.5 h-2.5" /> Exacto = 3 pts
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-full">
                <TrendingUp className="w-2.5 h-2.5" /> Ganador = 1 pt
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] text-rose-400 bg-rose-500/10 border border-rose-500/10 px-2 py-1 rounded-full">
                Perdedor = 0 pts
              </span>
            </div>

            {leaderboard.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                Sin apuestas registradas. ¡Sé el primero!
              </div>
            ) : (
              <div className="space-y-3 md:max-h-[480px] md:overflow-y-auto pr-1">
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
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black border shrink-0 ${isTop
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
                        <span className={`text-sm font-black px-2.5 py-1 rounded-lg border ${user.points > 0
                          ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                          : "text-slate-500 bg-slate-800/40 border-white/5"
                          }`}>
                          {user.points} pts
                        </span>
                        {/* Ganancias: siempre visible */}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${user.prizeWon > 0
                          ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                          : "text-slate-600 bg-slate-800/20 border-white/5"
                          }`}>
                          {user.prizeWon > 0 ? `+${user.prizeWon.toFixed(0)} Bs.` : "0 Bs."}
                        </span>
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
      <section
        className={`glass-panel p-6 z-10 overflow-hidden ${mobileTab !== 'history' ? 'hidden md:block' : ''}`}
        id="section-bets-history"
      >
        <h2 className="text-lg font-extrabold text-slate-200 mb-6 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-emerald-400" /> Historial de Apuestas
        </h2>

        {sortedMatchIds.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            No se han registrado apuestas en este grupo todavía.
          </div>
        ) : (
          <div className="space-y-6">
            {sortedMatchIds.map((matchId) => {
              const matchBetsList = betsByMatch[matchId];
              const matchData = matches.find((m) => m.id === matchId);
              if (!matchData) return null;

              return (
                <div key={matchId} className="bg-slate-950/20 border border-white/5 rounded-xl overflow-hidden">
                  {/* Cabecera del Partido */}
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/40 px-4 py-3 border-b border-white/5">
                    <div className="flex items-center gap-2 text-xs md:text-sm font-semibold">
                      <span className="flex shrink-0">{getFlag(matchData.team_a)}</span>
                      <span className="text-slate-200">{matchData.team_a}</span>
                      <span className="text-slate-500">vs</span>
                      <span className="text-slate-200">{matchData.team_b}</span>
                      <span className="flex shrink-0">{getFlag(matchData.team_b)}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono" suppressHydrationWarning>
                      {formatToBoliviaTime(matchData.kickoff_time)}
                    </div>
                  </div>

                  {/* Tabla de Apuestas para este partido */}
                  <div className="overflow-x-auto">
                    <table className="custom-table w-full">
                      <thead>
                        <tr>
                          <th>Participante</th>
                          <th>Pronóstico</th>
                          <th>Apostado</th>
                          <th>Premio</th>
                          <th>Resultado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {matchBetsList.map((bet) => {
                          const ev = evaluateBetDisplay(bet);
                          const prize = Number(bet.prize_won ?? 0);
                          return (
                            <tr key={bet.id}>
                              <td className="font-bold text-slate-200">{bet.participant_name}</td>
                              <td className="font-mono text-slate-200 text-sm font-semibold">
                                {bet.predicted_score_a} - {bet.predicted_score_b}
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
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Footer */}
        <footer className="mt-12 text-center text-xs text-slate-600 py-6 border-t border-white/5">
          <p>Copa Mundial de Fútbol 2026 | Desarrollado con Next.js y Supabase</p>
          <p className="mt-1">Zona Horaria: Bolivia (UTC-4)</p>
        </footer>
      </div>

      {/* Modal del Simulador / Administrador */}
      {isAdminMode && selectedMatch && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto"
          onClick={() => setIsAdminMode(false)}
        >
          <div
            className="relative w-full max-w-lg my-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Botón de cerrar */}
            <button
              onClick={() => setIsAdminMode(false)}
              className="absolute top-3.5 right-3.5 text-slate-400 hover:text-slate-200 cursor-pointer bg-slate-800/80 p-1.5 rounded-full hover:bg-slate-700 transition z-10 border border-white/10"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>

            <SimulatorPanel
              selectedMatch={selectedMatch}
              simScoreA={simScoreA}
              simScoreB={simScoreB}
              setSimScoreA={setSimScoreA}
              setSimScoreB={setSimScoreB}
              simError={simError}
              isPendingSim={isPendingSim}
              handleSimulateScore={handleSimulateScore}
              handleResetMatch={handleResetMatch}
              matchBets={matchBets}
              matchTotalPool={matchTotalPool}
            />
          </div>
        </div>
      )}

      {/* ── Mobile Bottom Tab Bar ─────────────────────────── */}
      <nav className="mobile-bottom-nav md:hidden" aria-label="Navegación principal">
        <button
          className={`mobile-tab-btn ${mobileTab === 'matches' ? 'active' : ''}`}
          onClick={() => setMobileTab('matches')}
          aria-label="Partidos"
        >
          <CalendarDays className="w-5 h-5" />
          Partidos
          {/* Badge: número de partidos en vivo */}
          {matches.filter(m => m.status === 'live' || (m.status === 'scheduled' && new Date(m.kickoff_time) <= new Date())).length > 0 && (
            <span className="tab-badge">
              {matches.filter(m => m.status === 'live' || (m.status === 'scheduled' && new Date(m.kickoff_time) <= new Date())).length}
            </span>
          )}
        </button>

        <button
          className={`mobile-tab-btn ${mobileTab === 'bet' ? 'active' : ''}`}
          onClick={() => { setMobileTab('bet'); }}
          aria-label="Apostar"
        >
          <Ticket className="w-5 h-5" />
          Apostar
        </button>

        <button
          className={`mobile-tab-btn ${mobileTab === 'leaderboard' ? 'active-gold' : ''}`}
          onClick={() => setMobileTab('leaderboard')}
          aria-label="Clasificación"
        >
          <Trophy className="w-5 h-5" />
          Tabla
        </button>

        <button
          className={`mobile-tab-btn ${mobileTab === 'history' ? 'active' : ''}`}
          onClick={() => setMobileTab('history')}
          aria-label="Historial"
        >
          <ListOrdered className="w-5 h-5" />
          Historial
        </button>
      </nav>
    </div>
  );
}
