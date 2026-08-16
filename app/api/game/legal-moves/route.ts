import { NextRequest, NextResponse } from 'next/server';
import { movesDto } from '@/lib/chess/dto';
import { legalMoves, legalMovesFrom, resolveState } from '@/lib/chess/gameOps';
import { squareFromAlgebraic } from '@/lib/chess/types';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const fenParam = query.get('fen');
  const squareParam = query.get('square');

  let state;
  try {
    state = resolveState(fenParam);
  } catch (e) {
    return NextResponse.json({ error: `Invalid 'fen': ${(e as Error).message}` }, { status: 400 });
  }

  let moves;
  if (squareParam && squareParam.trim() !== '') {
    let sq;
    try {
      sq = squareFromAlgebraic(squareParam);
    } catch {
      return NextResponse.json({ error: `Invalid 'square' parameter: ${squareParam}` }, { status: 400 });
    }
    moves = legalMovesFrom(state, sq);
  } else {
    moves = legalMoves(state);
  }

  return NextResponse.json({ square: squareParam, count: moves.length, moves: movesDto(moves) });
}
