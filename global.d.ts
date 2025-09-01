import mongo from "mongoose";

declare global {
     
    var mongoose: {
        conn: typeof mongo | null;
        promise: Promise<typeof mongo> | null;
    } | undefined;
}

export { };