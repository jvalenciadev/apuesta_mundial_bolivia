interface MatchForRollover {
  id: string;
  kickoff_time: string | Date;
  status: string;
  score_a: number | null;
  score_b: number | null;
}

interface BetForRollover {
  match_id: string;
  amount: number | string;
  predicted_score_a: number;
  predicted_score_b: number;
}

export function computeGroupRollovers(
  matches: MatchForRollover[],
  bets: BetForRollover[]
): Record<string, { rolloverCarriedIn: number; totalPool: number; hasWinners: boolean; betPool: number }> {
  // Sort matches by kickoff time
  const sortedMatches = [...matches].sort(
    (a, b) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime()
  );

  const results: Record<string, { rolloverCarriedIn: number; totalPool: number; hasWinners: boolean; betPool: number }> = {};
  let currentRollover = 0;

  for (const m of sortedMatches) {
    const matchBets = bets.filter((b) => b.match_id === m.id);
    const betPool = matchBets.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
    
    // The rollover carried into this match is the current accumulated rollover
    const rolloverCarriedIn = currentRollover;
    const totalPool = betPool + rolloverCarriedIn;

    // Check if there are exact winners
    const isFinished = m.status === "finished";
    
    let hasWinners = false;
    if (isFinished && m.score_a !== null && m.score_b !== null) {
      hasWinners = matchBets.some(
        (b) => b.predicted_score_a === m.score_a && b.predicted_score_b === m.score_b
      );
    }

    results[m.id] = {
      rolloverCarriedIn,
      totalPool,
      hasWinners,
      betPool
    };

    if (isFinished) {
      if (hasWinners) {
        // Pool is distributed
        currentRollover = 0;
      } else {
        // Pool rolls over
        currentRollover = totalPool;
      }
    } else {
      // First unfinished match holds the rollover. Subsequent unfinished matches start at 0 rollover.
      currentRollover = 0;
    }
  }

  return results;
}
