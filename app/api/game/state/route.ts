import { NextRequest, NextResponse } from 'next/server';
import { gameStateDto } from '@/lib/chess/dto';
import { resolveState, statusOf } from '@/lib/chess/gameOps';
import { toFen } from '@/lib/chess/fen';

export async function GET(request: NextRequest) {
  const fenParam = request.nextUrl.searchParams.get('fen');
  let state;
  try {
    state = resolveState(fenParam);
  } catch (e) {
    return NextResponse.json({ error: `Invalid 'fen': ${(e as Error).message}` }, { status: 400 });
  }
  return NextResponse.json(gameStateDto(state, statusOf(state), toFen(state)));
}
