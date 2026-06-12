"use client";

import { getFlagSVG } from "@/utils/flags";
import {
  Wrench,
  RotateCcw,
  Loader2,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  Trophy,
  Minus,
  TrendingUp,
  Ban,
  Coins,
} from "lucide-react";

interface Match {
  id: string;
  team_a: string;
  team_b: string;
  score_a: number | null;
  score_b: number | null;
  status: string;
  rollover_pool: number;
}

interface Bet {
  id: string;
  participant_name: string;
  predicted_score_a: number;
  predicted_score_b: number;
  amount: number;
  result_status: string;
}

interface SimulatorPanelProps {
  selectedMatch: Match;
  simScoreA: string;
  simScoreB: string;
  setSimScoreA: (v: string) => void;
  setSimScoreB: (v: string) => void;
  simError: string;
  isPendingSim: boolean;
  handleSimulateScore: (e: React.FormEvent) => void;
  handleResetMatch: () => void;
  matchBets: Bet[];
  matchTotalPool: number;
}

type PreviewResult = {
  name: string;
  predicted: string;
  amount: number;
  status: "exact" | "winner" | "loser";
  prizeShare: number;
};

function computeOutcome(predA: number, predB: number, actA: number, actB: number) {
  if (predA === actA && predB === actB) return "exact" as const;
  if (Math.sign(predA - predB) === Math.sign(actA - actB)) return "winner" as const;
  return "loser" as const;
}

function ScoreButton({
  direction,
  onClick,
  disabled,
}: {
  direction: "up" | "down";
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-white/10 text-slate-300 transition disabled:opacity-30 cursor-pointer"
    >
      {direction === "up" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
    </button>
  );
}

export default function SimulatorPanel({
  selectedMatch,
  simScoreA,
  simScoreB,
  setSimScoreA,
  setSimScoreB,
  simError,
  isPendingSim,
  handleSimulateScore,
  handleResetMatch,
  matchBets,
  matchTotalPool,
}: SimulatorPanelProps) {
  const sA = parseInt(simScoreA) || 0;
  const sB = parseInt(simScoreB) || 0;

  const inc = (get: string, set: (v: string) => void) =>
    set(String(Math.max(0, parseInt(get) || 0) + 1));
  const dec = (get: string, set: (v: string) => void) =>
    set(String(Math.max(0, (parseInt(get) || 0) - 1)));

  // Live preview: who wins with the current score input
  const preview: PreviewResult[] = matchBets.map((bet) => {
    const status = computeOutcome(bet.predicted_score_a, bet.predicted_score_b, sA, sB);
    return {
      name: bet.participant_name,
      predicted: `${bet.predicted_score_a} - ${bet.predicted_score_b}`,
      amount: Number(bet.amount),
      status,
      prizeShare: 0,
    };
  });

  const winners = preview.filter((p) => p.status === "exact");

  preview.forEach((p) => {
    if (p.status === "exact" && winners.length > 0) {
      p.prizeShare = Math.round((matchTotalPool / winners.length) * 100) / 100;
    }
  });

  const matchOutcomeLabel =
    sA > sB
      ? `Gana ${selectedMatch.team_a}`
      : sB > sA
      ? `Gana ${selectedMatch.team_b}`
      : "Empate";

  const statusColors: Record<string, string> = {
    exact: "text-amber-400",
    winner: "text-emerald-400",
    loser: "text-rose-500/60",
  };
  const statusIcons: Record<string, React.ReactNode> = {
    exact: <Trophy className="w-3 h-3" />,
    winner: <TrendingUp className="w-3 h-3" />,
    loser: <Ban className="w-3 h-3" />,
  };
  const statusLabels: Record<string, string> = {
    exact: "Exacto",
    winner: sA === sB ? "Empate ✓" : "Ganador ✓",
    loser: "Pierde",
  };

  return (
    <div
      className="rounded-2xl border border-amber-500/30 bg-gradient-to-b from-slate-900/80 to-slate-950/60 backdrop-blur-md shadow-[0_8px_32px_rgba(251,191,36,0.08)] overflow-hidden"
      id="simulator-panel"
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-white/5 bg-amber-500/5">
        <Wrench className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-bold text-amber-400 uppercase tracking-wider">
          Panel de Resultados
        </span>
        <span className="ml-auto text-[10px] text-slate-500 uppercase">Solo administrador</span>
      </div>

      <form onSubmit={handleSimulateScore} className="p-5 space-y-5">

        {/* Tablero de marcador */}
        <div className="relative bg-slate-950/60 rounded-2xl border border-white/8 p-4">
          {/* Resultado en texto */}
          <div className="text-center mb-4">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
              Resultado
            </span>
            <p className="text-xs font-bold text-amber-400 mt-0.5">{matchOutcomeLabel}</p>
          </div>

          <div className="flex items-center justify-between gap-2">
            {/* Equipo A */}
            <div className="flex flex-col items-center gap-2 flex-1">
              <div className="flex shrink-0">{getFlagSVG(selectedMatch.team_a)}</div>
              <span className="text-xs font-bold text-slate-200 text-center leading-tight truncate max-w-[80px]">
                {selectedMatch.team_a}
              </span>
              {/* Spinner de goles */}
              <div className="flex flex-col items-center gap-1">
                <ScoreButton direction="up" onClick={() => inc(simScoreA, setSimScoreA)} disabled={isPendingSim} />
                <input
                  id="sim-score-a"
                  type="number"
                  min="0"
                  value={simScoreA}
                  onChange={(e) => setSimScoreA(e.target.value)}
                  disabled={isPendingSim}
                  className="w-16 text-center text-3xl font-black text-slate-100 bg-transparent border-b-2 border-amber-500/50 focus:border-amber-400 outline-none py-1 transition"
                />
                <ScoreButton direction="down" onClick={() => dec(simScoreA, setSimScoreA)} disabled={isPendingSim} />
              </div>
            </div>

            {/* Separador */}
            <div className="flex flex-col items-center gap-1">
              <Minus className="w-5 h-5 text-slate-600" />
            </div>

            {/* Equipo B */}
            <div className="flex flex-col items-center gap-2 flex-1">
              <div className="flex shrink-0">{getFlagSVG(selectedMatch.team_b)}</div>
              <span className="text-xs font-bold text-slate-200 text-center leading-tight truncate max-w-[80px]">
                {selectedMatch.team_b}
              </span>
              <div className="flex flex-col items-center gap-1">
                <ScoreButton direction="up" onClick={() => inc(simScoreB, setSimScoreB)} disabled={isPendingSim} />
                <input
                  id="sim-score-b"
                  type="number"
                  min="0"
                  value={simScoreB}
                  onChange={(e) => setSimScoreB(e.target.value)}
                  disabled={isPendingSim}
                  className="w-16 text-center text-3xl font-black text-slate-100 bg-transparent border-b-2 border-amber-500/50 focus:border-amber-400 outline-none py-1 transition"
                />
                <ScoreButton direction="down" onClick={() => dec(simScoreB, setSimScoreB)} disabled={isPendingSim} />
              </div>
            </div>
          </div>
        </div>

        {/* Pozo a distribuir */}
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/20">
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <Coins className="w-3.5 h-3.5 text-emerald-400" />
            Pozo a distribuir
          </span>
          <span className="text-base font-black text-emerald-400">
            {matchTotalPool.toFixed(0)} Bs.
          </span>
        </div>

        {/* Preview de ganadores */}
        {matchBets.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-1">
              Preview distribución con este marcador
            </p>
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
              {preview.map((p, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg border transition ${
                    p.status === "exact"
                      ? "bg-amber-500/8 border-amber-500/25"
                      : p.status === "winner"
                      ? "bg-emerald-500/8 border-emerald-500/20"
                      : "bg-slate-900/40 border-white/5 opacity-50"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`flex items-center gap-0.5 text-[10px] font-bold ${statusColors[p.status]}`}>
                      {statusIcons[p.status]}
                    </span>
                    <span className="text-xs font-semibold text-slate-200 truncate">{p.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono shrink-0">
                      ({p.predicted})
                    </span>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    {p.status === "exact" ? (
                      <span className="text-xs font-black text-emerald-400">
                        +{p.prizeShare.toFixed(0)} Bs.
                      </span>
                    ) : (
                      <span className={`text-[10px] font-bold ${statusColors[p.status]}`}>
                        {statusLabels[p.status]}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Resumen */}
            {winners.length === 0 && matchBets.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                Nadie acierta — el pozo pasará al siguiente partido
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-xs text-slate-500 py-2">
            Sin apuestas registradas para este partido.
          </div>
        )}

        {simError && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{simError}</span>
          </div>
        )}

        {/* Acciones */}
        <div className="grid grid-cols-2 gap-2 pt-1">
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
            className="btn-gold text-sm py-2.5 cursor-pointer flex items-center justify-center gap-1.5 font-bold"
            id="btn-sim-submit"
          >
            {isPendingSim ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Procesando...</>
            ) : (
              <>Confirmar Score</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
