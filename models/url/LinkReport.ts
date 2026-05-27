import mongoose, { Schema, Document, Model } from "mongoose";

export type ReportReason =
  | "phishing"
  | "malware"
  | "spam"
  | "inappropriate"
  | "other";

export const REPORT_REASONS: ReportReason[] = [
  "phishing",
  "malware",
  "spam",
  "inappropriate",
  "other",
];

export interface ILinkReport extends Document {
  urlCode: string;
  reason: ReportReason;
  details?: string;
  reporterIpHash?: string;
  status: "open" | "reviewed" | "dismissed";
  createdAt: Date;
}

const LinkReportSchema = new Schema<ILinkReport>({
  urlCode: { type: String, required: true, index: true },
  reason: {
    type: String,
    enum: REPORT_REASONS,
    required: true,
  },
  details: { type: String, maxlength: 1000 },
  reporterIpHash: { type: String },
  status: {
    type: String,
    enum: ["open", "reviewed", "dismissed"],
    default: "open",
    index: true,
  },
  createdAt: { type: Date, default: Date.now },
});

const LinkReport: Model<ILinkReport> =
  mongoose.models.LinkReport ||
  mongoose.model<ILinkReport>("LinkReport", LinkReportSchema);

export default LinkReport;
