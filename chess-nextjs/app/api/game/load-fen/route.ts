import { NextRequest, NextResponse } from 'next/server';
import { gameStateDto } from '@/lib/chess/dto';
import { getGameSession } from '@/lib/chess/gameSession';

export async function POST(request: NextRequest) {
  const session = getGameSession();
  const body = await safeJson(request);
  const fenString = typeof body.fen === 'string' ? body.fen : '';
  if (!fenString.trim()) {
    return NextResponse.json({ error: "Missing or invalid required field: 'fen'" }, { status: 400 });
  }

  try {
    session.loadFen(fenString);
  } catch (e) {
    return NextResponse.json({ error: `Invalid FEN: ${(e as Error).message}` }, { status: 400 });
  }

  return NextResponse.json(gameStateDto(session.currentState(), session.currentStatus(), session.currentFen()));
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
