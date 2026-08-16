import { NextRequest, NextResponse } from 'next/server';
import { moveDto } from '@/lib/chess/dto';
import { getGameSession } from '@/lib/chess/gameSession';
import { pieceTypeFromFenChar, squareFromAlgebraic } from '@/lib/chess/types';

export async function POST(request: NextRequest) {
  const session = getGameSession();
  const body = await safeJson(request);

  let from, to;
  try {
    from = squareFromAlgebraic(String(body.from ?? ''));
    to = squareFromAlgebraic(String(body.to ?? ''));
  } catch (e) {
    return NextResponse.json({ error: `Invalid 'from'/'to' square: ${(e as Error).message}` }, { status: 400 });
  }

  let promotion = null;
  const promoRaw = body.promotion;
  if (typeof promoRaw === 'string' && promoRaw.trim() !== '') {
    try {
      promotion = pieceTypeFromFenChar(promoRaw.charAt(0));
    } catch {
      return NextResponse.json({ error: `Invalid 'promotion' piece: ${promoRaw}` }, { status: 400 });
    }
  }

  const result = session.makeMove(from, to, promotion);

  if (!result.legal) {
    return NextResponse.json({ legal: false, reason: result.reason });
  }

  const applied = result.move;
  const detail = moveDto(applied);
  return NextResponse.json({
    legal: true,
    move: detail.uci,
    piece: detail.piece,
    from: detail.from,
    to: detail.to,
    isCapture: detail.isCapture,
    type: applied.type,
    status: session.currentStatus(),
    fen: session.currentFen(),
  });
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
