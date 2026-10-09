import { getServerSession } from "@/lib/session";
import { connectDB } from "@/lib/mongodb";
import Tag from "@/models/url/Tag";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getServerSession();
  const user = session?.user;

  if (!user) {
    return NextResponse.json(
      { success: false, tag: undefined },
      { status: 403 },
    );
  }
  const sub = user?.sub;
  try {
    await connectDB();
    if (id) {
      const tag = await Tag.findOne({
        sub,
        id,
      }).lean();

      if (!tag) {
        return NextResponse.json(
          { success: true, tag: undefined },
          { status: 404 },
        );
      }
      const lean = { ...tag, _id: tag._id.toString() };
      return NextResponse.json({ success: true, tag: lean }, { status: 200 });
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return NextResponse.json(
      { success: false, tag: undefined },
      { status: 500 },
    );
  }
}
