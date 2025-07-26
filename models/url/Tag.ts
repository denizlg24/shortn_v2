import mongoose, { Schema, Document, Model } from "mongoose";

export interface ITag extends Document {
    sub: string;
    id: string;
    tagName: string;
}

export const tagSchema = new Schema<ITag>({
    sub: { type: String },
    id: { type: String },
    tagName: { type: String, index: true }
})

tagSchema.index({ tagName: "text" });

const Tag: Model<ITag> = mongoose.models.Tag || mongoose.model<ITag>("Tag", tagSchema);

export default Tag;