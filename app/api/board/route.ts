import { NextRequest, NextResponse } from 'next/server';
import { boardDto } from '@/lib/chess/dto';
import { resolveState } from '@/lib/chess/gameOps';

export async function GET(request: NextRequest) {
  const fenParam = request.nextUrl.searchParams.get('fen');
  let state;
  try {
    state = resolveState(fenParam);
  } catch (e) {
    return NextResponse.json({ error: `Invalid 'fen': ${(e as Error).message}` }, { status: 400 });
  }
  return NextResponse.json(boardDto(state.board));
}
