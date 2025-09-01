
import { recordClickFromMiddleware } from '@/app/actions/linkActions';
import { NextResponse } from 'next/server';


export async function POST(req: Request) {
    try {
        const body = await req.json();
        const result = await recordClickFromMiddleware(body);
        return NextResponse.json(result);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
        return NextResponse.json({ error: 'Failed to track click' }, { status: 500 });
    }
}
