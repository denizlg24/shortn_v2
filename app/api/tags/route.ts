import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import Tag from "@/models/url/Tag";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");
    const session = await auth();
    const user = session?.user;

    if (!user) {
        return NextResponse.json({ success: false, tags: [] }, { status: 403 });
    }
    const sub = user?.sub;
    try {
        await connectDB();
        if (query) {
            const tags = await Tag.find({
                sub,
                $text: { $search: query }
            }).limit(10).lean();

            const lean = tags.map((tag) => ({ ...tag, _id: tag._id.toString() }));
            return NextResponse.json({ success: true, tags: lean }, { status: 200 });
        }

        const tags = await Tag.find({
            sub,
        }).limit(10).lean();
        const lean = tags.map((tag) => ({ ...tag, _id: tag._id.toString() }));
        return NextResponse.json({ success: true, tags: lean }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, tags: [] }, { status: 500 });
    }

}