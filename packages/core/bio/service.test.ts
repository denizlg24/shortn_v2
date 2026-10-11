import { expect, test } from "bun:test";
import { bioLinksSchema, bioPatchSchema } from "./service";

test("bio images accept local uploaded assets and reject non-HTTP URLs", () => {
  for (const host of ["localhost", "127.0.0.1", "app.shortn.at"]) {
    const image = `http://${host}:3000/api/assets/uploads/workspaces/id/image.png`;
    expect(
      bioPatchSchema.safeParse({
        avatarUrl: image,
        theme: {
          header: {
            headerStyle: "centered",
            headerBackgroundImage: image,
          },
        },
      }).success,
    ).toBe(true);
    expect(bioLinksSchema.safeParse([{ linkId: "id", image }]).success).toBe(
      true,
    );
  }
  for (const image of [
    "javascript:alert(1)",
    "data:image/png;base64,AA",
    "file:///tmp/image.png",
  ]) {
    expect(bioPatchSchema.safeParse({ avatarUrl: image }).success).toBe(false);
    expect(bioLinksSchema.safeParse([{ linkId: "id", image }]).success).toBe(
      false,
    );
  }
});
