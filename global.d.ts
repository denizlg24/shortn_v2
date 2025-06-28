import mongo from "mongoose";

declare global {
    // eslint-disable-next-line no-var
    var mongoose: {
        conn: typeof mongo | null;
        promise: Promise<typeof mongo> | null;
    } | undefined;
}

export { };