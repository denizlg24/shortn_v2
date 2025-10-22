import fs from "fs";
import path from "path";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const filePath = searchParams.get("file");

  if (!filePath || !fs.existsSync(filePath)) {
    return new Response("File not found", { status: 404 });
  }

  const filename = path.basename(filePath);

  try {
    const fileBuffer = fs.readFileSync(filePath);

    const response = new Response(fileBuffer, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });

    fs.unlink(filePath, (err) => {
      if (err) console.error("❌ Failed to delete temp file:", err);
      else console.log("🗑️ Deleted temp file:", filePath);
    });

    return response;
  } catch (error) {
    console.error("Error serving CSV:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
