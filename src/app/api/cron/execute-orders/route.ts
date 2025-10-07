
// This file is no longer in use. Order execution is handled on the client-side.
import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({ message: 'This endpoint is deprecated. Order execution is now handled on the client.' });
}
