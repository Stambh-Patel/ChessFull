import { NextResponse } from 'next/server';
import { boardDto } from '@/lib/chess/dto';
import { getGameSession } from '@/lib/chess/gameSession';

export async function GET() {
  const session = getGameSession();
  return NextResponse.json(boardDto(session.currentState().board));
}
