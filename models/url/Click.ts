import mongoose, { Schema, Document, Model } from "mongoose";

export interface ClickEntry extends Document {
    sub:string;
    urlCode:string;
    timestamp: Date;
    ip: string;
    type:'click'|'scan';
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

const ClickEntrySchema = new Schema<ClickEntry>(
    {
        sub:{type:String},
        type:{type:String,default:'click'},
        urlCode:{type:String},
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
);

ClickEntrySchema.index({ urlCode: "hashed", sub:'hashed' });

const Clicks: Model<ClickEntry> =
    mongoose.models.Clicks || mongoose.model<ClickEntry>("Clicks", ClickEntrySchema);

export default Clicks;