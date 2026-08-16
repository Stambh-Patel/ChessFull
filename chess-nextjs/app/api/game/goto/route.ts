import { NextRequest, NextResponse } from 'next/server';
import { gameStateDto } from '@/lib/chess/dto';
import { getGameSession } from '@/lib/chess/gameSession';

export async function POST(request: NextRequest) {
  const session = getGameSession();
  const body = await safeJson(request);
  const plyRaw = body.ply;
  const ply = typeof plyRaw === 'number' ? plyRaw : -1;
  const ok = session.jumpToPly(ply);
  if (!ok) {
    return NextResponse.json({ success: false, reason: `Invalid ply index: ${plyRaw}` });
  }
  return NextResponse.json({
    ...gameStateDto(session.currentState(), session.currentStatus(), session.currentFen()),
    success: true,
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
