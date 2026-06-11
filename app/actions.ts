"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export type ActionResponse = {
  success: boolean;
  error?: string;
  data?: any;
};

/**
 * Crea un nuevo grupo de apuestas
 */
export async function createGroup(name: string, code: string): Promise<ActionResponse> {
  if (!name.trim() || !code.trim()) {
    return { success: false, error: "El nombre y el código secreto son requeridos." };
  }

  const cleanCode = code.trim().toLowerCase();
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // Verificar si el código ya existe
  const { data: existingGroup } = await supabase
    .from("groups")
    .select("id")
    .eq("code", cleanCode)
    .single();

  if (existingGroup) {
    return { success: false, error: "Este código secreto ya está en uso. Por favor elige otro." };
  }

  // Insertar el nuevo grupo
  const { data: newGroup, error } = await supabase
    .from("groups")
    .insert([{ name: name.trim(), code: cleanCode }])
    .select()
    .single();

  if (error || !newGroup) {
    return { success: false, error: "Error al crear el grupo en la base de datos." };
  }

  // Guardar acceso en cookies (expira en 7 días)
  cookieStore.set(`group_session_${newGroup.id}`, "true", {
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  // Redirigir al panel del grupo
  redirect(`/grupo/${newGroup.id}`);
}

/**
 * Ingresar a un grupo existente mediante su código secreto
 */
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

  // Guardar acceso en cookies (expira en 7 días)
  cookieStore.set(`group_session_${group.id}`, "true", {
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  // Redirigir al panel del grupo
  redirect(`/grupo/${group.id}`);
}

/**
 * Salir del grupo actual (borrar cookie de sesión)
 */
export async function leaveGroup(groupId: string) {
  const cookieStore = await cookies();
  cookieStore.delete(`group_session_${groupId}`);
  redirect("/");
}

/**
 * Registrar una apuesta dentro de un grupo
 */
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

  // Validar si el usuario está autorizado para este grupo
  const session = cookieStore.get(`group_session_${groupId}`);
  if (!session || session.value !== "true") {
    return { success: false, error: "No autorizado para este grupo." };
  }

  const { error } = await supabase.from("bets").insert([
    {
      group_id: groupId,
      match_id: matchId,
      participant_name: participantName.trim(),
      predicted_score_a: predScoreA,
      predicted_score_b: predScoreB,
      amount: amount,
    },
  ]);

  if (error) {
    return { success: false, error: `Error al registrar la apuesta: ${error.message}` };
  }

  revalidatePath(`/grupo/${groupId}`);
  return { success: true };
}

/**
 * Simular o actualizar el resultado de un partido (Uso administrativo / Simulación)
 */
export async function updateMatchScore(
  groupId: string,
  matchId: string,
  scoreA: number | null,
  scoreB: number | null
): Promise<ActionResponse> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const isFinished = scoreA !== null && scoreB !== null;
  const updateData = {
    score_a: scoreA,
    score_b: scoreB,
    status: isFinished ? "finished" : "scheduled",
  };

  // 1. Actualizar el partido
  const { error: matchError } = await supabase
    .from("matches")
    .update(updateData)
    .eq("id", matchId);

  if (matchError) {
    return { success: false, error: `Error al actualizar el partido: ${matchError.message}` };
  }

  // 2. Obtener todas las apuestas para este partido para reevaluarlas
  const { data: bets, error: betsError } = await supabase
    .from("bets")
    .select("id, predicted_score_a, predicted_score_b")
    .eq("match_id", matchId);

  if (betsError) {
    return { success: false, error: `Error al obtener las apuestas para evaluar: ${betsError.message}` };
  }

  // 3. Calcular puntos y actualizar en lote (upsert)
  if (bets && bets.length > 0) {
    const upsertData = bets.map((bet) => {
      if (!isFinished) {
        return {
          id: bet.id,
          points_won: 0,
          result_status: "pending",
        };
      }

      const actA = scoreA!;
      const actB = scoreB!;
      const predA = bet.predicted_score_a;
      const predB = bet.predicted_score_b;

      let pts = 0;
      let status: "exact" | "outcome" | "fail" = "fail";

      if (actA === predA && actB === predB) {
        pts = 3;
        status = "exact";
      } else {
        const actualDiff = actA - actB;
        const predDiff = predA - predB;
        const actualWinner = actualDiff > 0 ? 1 : actualDiff < 0 ? -1 : 0;
        const predWinner = predDiff > 0 ? 1 : predDiff < 0 ? -1 : 0;

        if (actualWinner === predWinner) {
          pts = 1;
          status = "outcome";
        }
      }

      return {
        id: bet.id,
        points_won: pts,
        result_status: status,
      };
    });

    const { error: upsertError } = await supabase
      .from("bets")
      .upsert(upsertData);

    if (upsertError) {
      return { success: false, error: `Error al guardar los resultados de apuestas: ${upsertError.message}` };
    }
  }

  revalidatePath(`/grupo/${groupId}`);
  return { success: true };
}
