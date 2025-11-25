import mongoose, { Schema, Document, Model } from "mongoose";
import UrlV3, { IUrl } from "../url/UrlV3";
import { ok } from "assert";

ok(UrlV3);

export interface IHeader extends Document {
  headerStyle: "centered" | "left-aligned" | "right-aligned";
  headerImageUrl?: string;
  headerImageStyle: "square" | "rounded" | "circle";
  headerBackgroundImage?: string;
  headerBackgroundColor: string;
  headerTitle?: string;
  headerSubtitle?: string;
}

export interface IBioPage extends Document {
  userId: string;
  slug: string;
  title: string;
  description?: string;
  avatarUrl?: string;
  theme?: {
    primaryColor?: string;
    background?: string;
    textColor?: string;
    buttonStyle?: "rounded" | "square" | "pill";
    header?: IHeader;
  };
  links: {
    link: mongoose.Types.ObjectId | IUrl;
    image?: string;
    title?: string;
  }[];
  socials?: {
    instagram?: string;
    twitter?: string;
    github?: string;
    linkedin?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const HeaderSchema: Schema = new Schema({
  headerStyle: {
    type: String,
    enum: ["centered", "left-aligned", "right-aligned"],
    default: "centered",
  },
  headerImageUrl: { type: String },
  headerImageStyle: {
    type: String,
    enum: ["square", "rounded", "circle"],
    default: "circle",
  },
  headerBackgroundImage: { type: String },
  headerBackgroundColor: { type: String, default: "#0f172b" },
  headerTitle: { type: String },
  headerSubtitle: { type: String },
});

const BioPageSchema: Schema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    slug: { type: String, required: true, unique: true },
    title: { type: String },
    description: { type: String },
    avatarUrl: { type: String },
    theme: {
      primaryColor: { type: String },
      background: { type: String },
      textColor: { type: String },
      buttonStyle: {
        type: String,
        enum: ["rounded", "square", "pill"],
        default: "rounded",
      },
      header: { type: HeaderSchema },
    },
    links: [
      {
        link: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "UrlV3",
          required: true,
        },
        image: { type: String },
        title: { type: String },
      },
    ],
    socials: {
      instagram: { type: String },
      twitter: { type: String },
      github: { type: String },
      linkedin: { type: String },
    },
  },
  { timestamps: true },
);

BioPageSchema.index({
  title: "text",
  slug: "text",
});

export const BioPage: Model<IBioPage> =
  mongoose.models.BioPage || mongoose.model<IBioPage>("BioPage", BioPageSchema);
