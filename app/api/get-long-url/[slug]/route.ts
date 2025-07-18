import { connectDB } from '@/lib/mongodb';
import UrlV3 from '@/models/url/UrlV3';
import { NextResponse } from 'next/server';

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
    await connectDB();
    const { slug } = await params;
    const urlDoc = await UrlV3.findOne({ urlCode: slug });
    if (!urlDoc) return NextResponse.json({ longUrl: null });
    return NextResponse.json({ longUrl: urlDoc.longUrl });
}