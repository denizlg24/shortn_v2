import mongoose, { Schema, Document, Model } from "mongoose";
import { ITag, tagSchema } from "./Tag";

interface ClickEntry {
    timestamp: Date;
    ip: string;
    country?: string;
    region?: string;
    city?: string;
    timezone?: string;
    language?: string;
    browser?: string;
    os?: string;
    deviceType?: string;
    userAgent: string;
    referrer?: string;
    pathname?: string;
    queryParams?: Record<string, string>;
}

export interface IUrl extends Document {
    sub?: string;
    urlCode: string;
    customCode: boolean;
    longUrl: string;
    shortUrl: string;
    qrCodeId?: string;
    isQrCode: boolean;
    title?: string;
    date: Date;
    tags?: { id: string, tagName: string, sub: string, _id: unknown }[];
    clicks: {
        total: number;
        lastClick: Date | null;
        all: ClickEntry[];
    };
    recordClick: (info: Partial<ClickEntry>) => Promise<IUrl>;
}

const ClickEntrySchema = new Schema<ClickEntry>(
    {
        timestamp: { type: Date, default: Date.now },
        ip: String,
        country: String,
        region: String,
        city: String,
        timezone: String,
        language: String,
        browser: String,
        os: String,
        deviceType: String,
        userAgent: String,
        referrer: String,
        pathname: String,
        queryParams: { type: Schema.Types.Mixed },
    },
    { _id: false }
);

const UrlSchema = new Schema<IUrl>({
    sub: { type: String, index: true },
    urlCode: { type: String, required: true },
    customCode: { type: Boolean, default: false },
    longUrl: { type: String, required: true },
    shortUrl: { type: String, required: true },
    qrCodeId: String,
    isQrCode: { type: Boolean, default: false },
    title: String,
    date: { type: Date, default: Date.now },
    tags: { type: [tagSchema], default: [], index: true },
    clicks: {
        total: { type: Number, default: 0 },
        lastClick: { type: Date, default: null },
        all: { type: [ClickEntrySchema], default: [] },
    },
});

UrlSchema.methods.recordClick = async function (info: Partial<ClickEntry>) {
    this.clicks.total++;
    this.clicks.lastClick = new Date();
    this.clicks.all.push({
        ...info,
        timestamp: new Date(),
    });
    return this.save();
};

UrlSchema.index({ urlCode: "text", longUrl: "text", title: "text", tags: "text" });

const UrlV3: Model<IUrl> =
    mongoose.models.UrlV3 || mongoose.model<IUrl>("UrlV3", UrlSchema);

export default UrlV3;