import { NextRequest, NextResponse } from 'next/server';
import { movesDto } from '@/lib/chess/dto';
import { getGameSession } from '@/lib/chess/gameSession';
import { squareFromAlgebraic } from '@/lib/chess/types';

export async function GET(request: NextRequest) {
  const session = getGameSession();
  const squareParam = request.nextUrl.searchParams.get('square');

  let moves;
  if (squareParam && squareParam.trim() !== '') {
    let sq;
    try {
      sq = squareFromAlgebraic(squareParam);
    } catch {
      return NextResponse.json({ error: `Invalid 'square' parameter: ${squareParam}` }, { status: 400 });
    }
    moves = session.legalMovesFrom(sq);
  } else {
    moves = session.legalMoves();
  }

  return NextResponse.json({ square: squareParam, count: moves.length, moves: movesDto(moves) });
}
