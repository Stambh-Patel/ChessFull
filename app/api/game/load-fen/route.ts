import { NextRequest, NextResponse } from 'next/server';
import { gameStateDto } from '@/lib/chess/dto';
import { resolveState, statusOf } from '@/lib/chess/gameOps';
import { toFen } from '@/lib/chess/fen';

/** Stateless: validates the given FEN and echoes back the parsed
 *  position. The client stores the result as its new current position. */
export async function POST(request: NextRequest) {
  const body = await safeJson(request);
  const fenString = typeof body.fen === 'string' ? body.fen : '';
  if (!fenString.trim()) {
    return NextResponse.json({ error: "Missing or invalid required field: 'fen'" }, { status: 400 });
  }

  let state;
  try {
    state = resolveState(fenString);
  } catch (e) {
    return NextResponse.json({ error: `Invalid FEN: ${(e as Error).message}` }, { status: 400 });
  }

  return NextResponse.json(gameStateDto(state, statusOf(state), toFen(state)));
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
