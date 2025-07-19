import mongoose, { Schema, Document, Model } from "mongoose";

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

export interface IQRCode extends Document {
    sub?: string;
    longUrl: string;
    qrCodeId: string;
    urlId: string;
    qrCodeBase64: string;
    title?: string;
    date: Date;
    tags?: string[];
    clicks: {
        total: number;
        lastClick: Date | null;
        all: ClickEntry[];
    };
    recordClick: (info: Partial<ClickEntry>) => Promise<IQRCode>;
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

const QRCodeSchema = new Schema<IQRCode>({
    sub: { type: String, index: true },
    longUrl: { type: String, required: true },
    urlId: String,
    qrCodeId: String,
    title: String,
    qrCodeBase64: String,
    date: { type: Date, default: Date.now },
    tags: [{ type: String }],
    clicks: {
        total: { type: Number, default: 0 },
        lastClick: { type: Date, default: null },
        all: { type: [ClickEntrySchema], default: [] },
    },
});

QRCodeSchema.methods.recordClick = async function (info: Partial<ClickEntry>) {
    this.clicks.total++;
    this.clicks.lastClick = new Date();
    this.clicks.all.push({
        ...info,
        timestamp: new Date(),
    });
    return this.save();
};

QRCodeSchema.index({ longUrl: "text", title: "text", tags: "text" });

const QRCodeV2: Model<IQRCode> =
    mongoose.models.QRCodesV2 || mongoose.model<IQRCode>("QRCodesV2", QRCodeSchema);

export default QRCodeV2;