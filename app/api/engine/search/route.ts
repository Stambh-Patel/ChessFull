import { NextRequest, NextResponse } from 'next/server';
import { searchResultWithTreeDto } from '@/lib/chess/dto';
import { resolveState } from '@/lib/chess/gameOps';
import { search } from '@/lib/chess/search';
import { GameState } from '@/lib/chess/types';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;

  const depth = intOrDefault(query.get('depth'), 3);
  const algorithm = query.get('algorithm') || 'alphabeta';
  const treeDepth = intOrDefault(query.get('treeDepth'), 2);

  let state: GameState;
  try {
    state = resolveState(query.get('fen'));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  try {
    const result = search(state, depth, algorithm);
    return NextResponse.json(searchResultWithTreeDto(result, treeDepth));
  } catch (e) {
    return NextResponse.json({ error: `Internal error: ${(e as Error).message}` }, { status: 500 });
  }
}

function intOrDefault(value: string | null, defaultValue: number): number {
  if (value === null) return defaultValue;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}
