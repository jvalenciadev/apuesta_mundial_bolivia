import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import GroupDashboardClient from "./GroupDashboardClient";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function GroupPage({ params }: PageProps) {
  const { id: groupId } = await params;

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // 1. Validar autorización de sesión del grupo
  const session = cookieStore.get(`group_session_${groupId}`);
  if (!session || session.value !== "true") {
    redirect("/");
  }

  // 2. Obtener información del grupo
  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("id, name, code")
    .eq("id", groupId)
    .single();

  if (groupError || !group) {
    redirect("/");
  }

  // 3. Obtener partidos (e insertar por defecto si está vacío)
  let { data: matches, error: matchesError } = await supabase
    .from("matches")
    .select("id, team_a, team_b, kickoff_time, score_a, score_b, status, group_stage, rollover_pool, prize_distributed")
    .order("kickoff_time", { ascending: true });

  if (matchesError) {
    matches = [];
  }

  // Auto-seeding si no hay partidos en la base de datos
  if (!matches || matches.length === 0) {
    const defaultMatches = [
      { team_a: "México", team_b: "Sudáfrica", kickoff_time: "2026-06-11T13:00:00Z", group_stage: "Grupo A", status: "scheduled" },
      { team_a: "Corea del Sur", team_b: "Chequia", kickoff_time: "2026-06-12T02:00:00Z", group_stage: "Grupo B", status: "scheduled" },
      { team_a: "Canadá", team_b: "Bosnia y Herzegovina", kickoff_time: "2026-06-12T16:00:00Z", group_stage: "Grupo C", status: "scheduled" },
      { team_a: "Estados Unidos", team_b: "Paraguay", kickoff_time: "2026-06-13T01:00:00Z", group_stage: "Grupo D", status: "scheduled" },
    ];

    const { data: insertedMatches } = await supabase
      .from("matches")
      .insert(defaultMatches)
      .select();

    if (insertedMatches) {
      matches = insertedMatches;
    }
  }

  // 4. Obtener apuestas del grupo
  const { data: bets, error: betsError } = await supabase
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
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });

  const cleanBets = (betsError || !bets ? [] : bets).map((b: any) => ({
    ...b,
    matches: Array.isArray(b.matches) ? b.matches[0] : (b.matches || null)
  }));

  return (
    <GroupDashboardClient
      group={group}
      initialMatches={matches || []}
      initialBets={cleanBets}
    />
  );
}
