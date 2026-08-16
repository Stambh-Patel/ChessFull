import { NextResponse } from 'next/server';
import { gameStateDto } from '@/lib/chess/dto';
import { getGameSession } from '@/lib/chess/gameSession';

export async function POST() {
  const session = getGameSession();
  const ok = session.redo();
  if (!ok) {
    return NextResponse.json({ success: false, reason: 'Nothing to redo - already at the latest move.' });
  }
  return NextResponse.json({
    ...gameStateDto(session.currentState(), session.currentStatus(), session.currentFen()),
    success: true,
  });
}
