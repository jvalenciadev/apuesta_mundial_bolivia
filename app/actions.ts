"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

export type ActionResponse = {
  success: boolean;
  error?: string;
  data?: unknown;
};

/**
 * Determina el resultado de una apuesta dado el marcador real.
 *
 * Sistema de puntos:
 *   3 pts → Acierto exacto (marcador exacto)
 *   1 pt  → Resultado correcto (ganador/empate, pero no marcador exacto)
 *   0 pts → Predicción incorrecta (fallo total)
 *
 * Para el pool de premios:
 *   Solo los aciertos exactos ("exact") ganan y se reparten el pozo de premios.
 */
function evaluatePrediction(
  predA: number,
  predB: number,
  actualA: number,
  actualB: number
): { points: 3 | 1 | 0; status: "exact" | "winner" | "loser" } {
  const actualOutcome = Math.sign(actualA - actualB); // 1, -1, 0
  const predOutcome = Math.sign(predA - predB);

  if (predA === actualA && predB === actualB) {
    return { points: 3, status: "exact" };
  }
  if (predOutcome === actualOutcome) {
    return { points: 1, status: "winner" };
  }
  return { points: 0, status: "loser" };
}

// ---------------------------------------------------------------------------
// createGroup
// ---------------------------------------------------------------------------
export async function createGroup(name: string, code: string): Promise<ActionResponse> {
  if (!name.trim() || !code.trim()) {
    return { success: false, error: "El nombre y el código secreto son requeridos." };
  }

  const cleanCode = code.trim().toLowerCase();
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: existingGroup } = await supabase
    .from("groups")
    .select("id")
    .eq("code", cleanCode)
    .single();

  if (existingGroup) {
    return { success: false, error: "Este código secreto ya está en uso. Por favor elige otro." };
  }

  const { data: newGroup, error } = await supabase
    .from("groups")
    .insert([{ name: name.trim(), code: cleanCode }])
    .select()
    .single();

  if (error || !newGroup) {
    return { success: false, error: "Error al crear el grupo en la base de datos." };
  }

  cookieStore.set(`group_session_${newGroup.id}`, "true", {
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  redirect(`/grupo/${newGroup.id}`);
}

// ---------------------------------------------------------------------------
// joinGroup
// ---------------------------------------------------------------------------
export async function joinGroup(code: string): Promise<ActionResponse> {
  if (!code.trim()) {
    return { success: false, error: "Debes ingresar un código secreto." };
  }

  const cleanCode = code.trim().toLowerCase();
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: group, error } = await supabase
    .from("groups")
    .select("id, name")
    .eq("code", cleanCode)
    .single();

  if (error || !group) {
    return { success: false, error: "No se encontró ningún grupo con ese código secreto." };
  }

  cookieStore.set(`group_session_${group.id}`, "true", {
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  redirect(`/grupo/${group.id}`);
}

// ---------------------------------------------------------------------------
// leaveGroup
// ---------------------------------------------------------------------------
export async function leaveGroup(groupId: string) {
  const cookieStore = await cookies();
  cookieStore.delete(`group_session_${groupId}`);
  redirect("/");
}

// ---------------------------------------------------------------------------
// placeBet
// ---------------------------------------------------------------------------
export async function placeBet(
  groupId: string,
  matchId: string,
  participantName: string,
  predScoreA: number,
  predScoreB: number,
  amount: number
): Promise<ActionResponse> {
  if (!participantName.trim()) {
    return { success: false, error: "El nombre del participante es requerido." };
  }
  if (predScoreA < 0 || predScoreB < 0) {
    return { success: false, error: "Los marcadores no pueden ser negativos." };
  }
  if (amount <= 0) {
    return { success: false, error: "El monto apostado debe ser mayor a 0." };
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const session = cookieStore.get(`group_session_${groupId}`);
  if (!session || session.value !== "true") {
    return { success: false, error: "No autorizado para este grupo." };
  }

  // Verificar el estado del partido y su hora de inicio
  const { data: match } = await supabase
    .from("matches")
    .select("status, kickoff_time")
    .eq("id", matchId)
    .single();

  if (!match) {
    return { success: false, error: "El partido no existe." };
  }

  const isMatchStarted = match.status !== "scheduled" || new Date(match.kickoff_time) <= new Date();

  // Verificar si ya existe una apuesta de este participante en este partido
  const { data: existingBet } = await supabase
    .from("bets")
    .select("id")
    .eq("match_id", matchId)
    .eq("group_id", groupId)
    .ilike("participant_name", participantName.trim())
    .maybeSingle();

  if (existingBet) {
    // Si ya existe la apuesta, se permite EDITARLA solo si el partido no ha empezado
    if (isMatchStarted) {
      return { success: false, error: "No puedes modificar tu apuesta una vez empezado el partido." };
    }

    // Se usa el cliente admin (service_role) para bypasear RLS en el UPDATE.
    // Es seguro porque este código solo corre en el servidor (Server Action).
    const adminSupabase = createAdminClient();
    const { data: updatedRows, error: updateError } = await adminSupabase
      .from("bets")
      .update({
        predicted_score_a: predScoreA,
        predicted_score_b: predScoreB,
        amount,
      })
      .eq("id", existingBet.id)
      .select("id");

    if (updateError) {
      return { success: false, error: `Error al actualizar la apuesta: ${updateError.message}` };
    }
    if (!updatedRows || updatedRows.length === 0) {
      return { success: false, error: `La apuesta no pudo actualizarse (id: ${existingBet.id}).` };
    }

    revalidatePath(`/grupo/${groupId}`);
    return { success: true };
  }

  // Si no existe, se crea una nueva apuesta (solo si el partido no ha empezado)
  if (isMatchStarted) {
    return { success: false, error: "No puedes apostar en un partido que ya empezó o terminó." };
  }

  const { error: insertError } = await supabase.from("bets").insert([
    {
      group_id: groupId,
      match_id: matchId,
      participant_name: participantName.trim(),
      predicted_score_a: predScoreA,
      predicted_score_b: predScoreB,
      amount,
      points_won: 0,
      prize_won: 0,
      result_status: "pending",
    },
  ]);

  if (insertError) {
    return { success: false, error: `Error al registrar la apuesta: ${insertError.message}` };
  }

  revalidatePath(`/grupo/${groupId}`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// updateMatchScore
// Core business logic: distribución dinámica del pozo con rollover
//
// Reglas:
//   1. Ganadores (pts=3) se reparten el pozo total del partido (apuestas + rollover)
//   2. Perdedores (pts=1) no reciben nada del pozo
//   3. Si nadie gana (0 ganadores) → todo el pozo se acumula en el SIGUIENTE partido
//      sin finalizar como rollover_pool
// ---------------------------------------------------------------------------
export async function updateMatchScore(
  groupId: string,
  matchId: string,
  scoreA: number | null,
  scoreB: number | null
): Promise<ActionResponse> {
  const adminSupabase = createAdminClient();

  const isFinished = scoreA !== null && scoreB !== null;

  // --- Reinicio de un partido ya evaluado ---
  if (!isFinished) {
    // Obtener información del partido actual y sus apuestas antes de resetear
    const { data: currentMatch } = await adminSupabase
      .from("matches")
      .select("rollover_pool, status, kickoff_time, prize_distributed")
      .eq("id", matchId)
      .single();

    if (currentMatch && currentMatch.prize_distributed) {
      // Ver si en este partido hubo ganadores de pozo (marcador exacto)
      const { data: matchBets } = await adminSupabase
        .from("bets")
        .select("result_status, amount")
        .eq("match_id", matchId)
        .eq("group_id", groupId);

      const hasWinners = matchBets && matchBets.some(b => b.result_status === "exact");

      // Si no hubo ganadores, el pozo de este partido se transfirió como rollover al siguiente.
      // Debemos deshacer esa transferencia.
      if (!hasWinners) {
        const matchPool = (matchBets || []).reduce((acc, b) => acc + Number(b.amount), 0);
        const totalPoolToDeduct = matchPool + Number(currentMatch.rollover_pool);

        // Buscar el siguiente partido que heredó este rollover
        const { data: nextMatch } = await adminSupabase
          .from("matches")
          .select("id, rollover_pool")
          .neq("id", matchId)
          .eq("status", "scheduled")
          .order("kickoff_time", { ascending: true })
          .limit(1)
          .single();

        if (nextMatch) {
          const cleanRollover = Math.max(0, Number(nextMatch.rollover_pool) - totalPoolToDeduct);
          await adminSupabase
            .from("matches")
            .update({ rollover_pool: cleanRollover })
            .eq("id", nextMatch.id);
        }
      }
    }

    await adminSupabase
      .from("matches")
      .update({ score_a: null, score_b: null, status: "scheduled", prize_distributed: false })
      .eq("id", matchId);

    // Resetear apuestas de este partido
    await adminSupabase
      .from("bets")
      .update({ points_won: 0, prize_won: 0, result_status: "pending" })
      .eq("match_id", matchId);

    revalidatePath(`/grupo/${groupId}`);
    return { success: true };
  }

  // --- Actualizar marcador ---
  const { error: matchError } = await adminSupabase
    .from("matches")
    .update({
      score_a: scoreA,
      score_b: scoreB,
      status: "finished",
      prize_distributed: false,
    })
    .eq("id", matchId);

  if (matchError) {
    return { success: false, error: `Error al actualizar el partido: ${matchError.message}` };
  }

  // --- Obtener match con rollover acumulado ---
  const { data: matchFull } = await adminSupabase
    .from("matches")
    .select("rollover_pool")
    .eq("id", matchId)
    .single();

  const accumulatedRollover = Number(matchFull?.rollover_pool ?? 0);

  // --- Obtener apuestas de este partido en este grupo ---
  const { data: bets, error: betsError } = await adminSupabase
    .from("bets")
    .select("id, predicted_score_a, predicted_score_b, amount, participant_name")
    .eq("match_id", matchId)
    .eq("group_id", groupId);

  if (betsError) {
    return { success: false, error: `Error al obtener las apuestas: ${betsError.message}` };
  }

  if (!bets || bets.length === 0) {
    revalidatePath(`/grupo/${groupId}`);
    return { success: true };
  }

  // --- Evaluar cada apuesta ---
  type BetResult = {
    id: string;
    points_won: number;
    result_status: "exact" | "winner" | "loser" | "pending";
    prize_won: number;
    amount: number;
  };

  const evaluated: BetResult[] = bets.map((bet) => {
    const { points, status } = evaluatePrediction(
      bet.predicted_score_a,
      bet.predicted_score_b,
      scoreA!,
      scoreB!
    );
    return {
      id: bet.id,
      points_won: points,
      result_status: status,
      prize_won: 0,
      amount: Number(bet.amount),
    };
  });

  // --- Calcular pool total del partido ---
  const matchPool = evaluated.reduce((acc, b) => acc + b.amount, 0);
  const totalPool = matchPool + accumulatedRollover;

  // --- Identificar ganadores del pozo (marcador exacto) ---
  const winners = evaluated.filter((b) => b.result_status === "exact");

  if (winners.length > 0) {
    // Distribuir el pool entre los ganadores en partes iguales
    const share = totalPool / winners.length;

    winners.forEach((w) => {
      w.prize_won = Math.round(share * 100) / 100;
    });

    // Marcar partido como distribuido
    await adminSupabase
      .from("matches")
      .update({ prize_distributed: true })
      .eq("id", matchId);

  } else {
    // Sin ganadores → el pool se transfiere al próximo partido sin finalizar
    // Obtener el siguiente partido por fecha
    const { data: nextMatch } = await adminSupabase
      .from("matches")
      .select("id, rollover_pool, kickoff_time")
      .neq("id", matchId)
      .eq("status", "scheduled")
      .order("kickoff_time", { ascending: true })
      .limit(1)
      .single();

    if (nextMatch) {
      const newRollover = Number(nextMatch.rollover_pool) + totalPool;
      await adminSupabase
        .from("matches")
        .update({ rollover_pool: newRollover })
        .eq("id", nextMatch.id);
    }

    // Marcar como distribuido (aunque sea rollover)
    await adminSupabase
      .from("matches")
      .update({ prize_distributed: true })
      .eq("id", matchId);
  }

  // --- Actualizar cada apuesta individualmente (update, no upsert) ---
  for (const bet of evaluated) {
    const { error: updateErr } = await adminSupabase
      .from("bets")
      .update({
        points_won: bet.points_won,
        result_status: bet.result_status,
        prize_won: bet.prize_won,
      })
      .eq("id", bet.id);

    if (updateErr) {
      return { success: false, error: `Error al guardar resultados: ${updateErr.message}` };
    }
  }

  revalidatePath(`/grupo/${groupId}`);
  return { success: true };
}
