import { NextResponse } from 'next/server';
import { movesDto } from '@/lib/chess/dto';
import { getGameSession } from '@/lib/chess/gameSession';

export async function GET() {
  const session = getGameSession();
  return NextResponse.json({
    moves: movesDto(session.fullMoveHistory()),
    count: session.historyLength(),
    currentPly: session.currentPly(),
  });
}
