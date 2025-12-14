import mongoose, { Schema, Document, Model } from "mongoose";
import { tagSchema } from "./Tag";
import { Options } from "qr-code-styling";

export interface TQRCode {
  _id: string;
  sub?: string;
  longUrl: string;
  qrCodeId: string;
  urlId: string;
  attachedUrl?: string;
  title?: string;
  date: Date;
  tags?: { id: string; tagName: string; sub: string; _id: unknown }[];
  options: Partial<Options>;
  clicks: {
    total: number;
    lastClick: Date | null;
  };
}
export interface IQRCode extends Document {
  sub?: string;
  longUrl: string;
  qrCodeId: string;
  urlId: string;
  attachedUrl?: string;
  title?: string;
  date: Date;
  tags?: { id: string; tagName: string; sub: string; _id: unknown }[];
  options: Partial<Options>;
  clicks: {
    total: number;
    lastClick: Date | null;
  };
  recordClick: () => Promise<IQRCode>;
}

const QRCodeSchema = new Schema<IQRCode>({
  sub: { type: String, index: true },
  longUrl: String,
  urlId: String,
  attachedUrl: String,
  qrCodeId: String,
  title: String,
  date: { type: Date, default: Date.now },
  tags: { type: [tagSchema], default: [], index: true },
  options: { type: Object, default: {} },
  clicks: {
    total: { type: Number, default: 0 },
    lastClick: { type: Date, default: null },
  },
});

QRCodeSchema.methods.recordClick = async function () {
  this.clicks.total++;
  this.clicks.lastClick = new Date();
  return this.save();
};

QRCodeSchema.index({ longUrl: "text", title: "text", tags: "text" });

const QRCodeV2: Model<IQRCode> =
  mongoose.models.QRCodesV2 ||
  mongoose.model<IQRCode>("QRCodesV2", QRCodeSchema);

export default QRCodeV2;
