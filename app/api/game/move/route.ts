import { NextRequest, NextResponse } from 'next/server';
import { moveDto } from '@/lib/chess/dto';
import { makeMove, resolveState, statusOf } from '@/lib/chess/gameOps';
import { pieceTypeFromFenChar, squareFromAlgebraic } from '@/lib/chess/types';

export async function POST(request: NextRequest) {
  const body = await safeJson(request);

  let state;
  try {
    state = resolveState(typeof body.fen === 'string' ? body.fen : null);
  } catch (e) {
    return NextResponse.json({ error: `Invalid 'fen': ${(e as Error).message}` }, { status: 400 });
  }

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

  const result = makeMove(state, from, to, promotion);

  if (!result.legal) {
    return NextResponse.json({ legal: false, reason: result.reason });
  }

  const detail = moveDto(result.move);
  const nextState = resolveState(result.resultingFen);

  return NextResponse.json({
    legal: true,
    move: detail.uci,
    piece: detail.piece,
    from: detail.from,
    to: detail.to,
    isCapture: detail.isCapture,
    type: result.move.type,
    status: statusOf(nextState),
    fen: result.resultingFen,
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
