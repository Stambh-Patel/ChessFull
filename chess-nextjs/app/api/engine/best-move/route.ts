import { NextRequest, NextResponse } from 'next/server';
import { searchResultWithTreeDto } from '@/lib/chess/dto';
import { parseFen } from '@/lib/chess/fen';
import { getGameSession } from '@/lib/chess/gameSession';
import { search } from '@/lib/chess/search';
import { GameState } from '@/lib/chess/types';

export async function POST(request: NextRequest) {
  const session = getGameSession();
  const body = await safeJson(request);

  const depth = intOrDefault(body.depth, 3);
  const algorithm = typeof body.algorithm === 'string' ? body.algorithm : 'alphabeta';

  let state: GameState;
  try {
    state = resolveState(body.fen, session);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  try {
    const result = search(state, depth, algorithm);
    return NextResponse.json(searchResultWithTreeDto(result, 2));
  } catch (e) {
    return NextResponse.json({ error: `Internal error: ${(e as Error).message}` }, { status: 500 });
  }
}

function resolveState(fenValue: unknown, session: ReturnType<typeof getGameSession>): GameState {
  if (typeof fenValue === 'string' && fenValue.trim() !== '') {
    return parseFen(fenValue);
  }
  return session.currentState();
}

function intOrDefault(value: unknown, defaultValue: number): number {
  if (value === null || value === undefined) return defaultValue;
  if (typeof value === 'number') return Math.trunc(value);
  const parsed = parseInt(String(value), 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

async function safeJson(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    const text = await request.text();
    if (!text || !text.trim()) return {};
    return JSON.parse(text);
  } catch {
    return {};
  }
}
