import mongoose, { Schema, Document, Model } from "mongoose";
import UrlV3, { IUrl } from "../url/UrlV3";
import { ok } from "assert";

ok(UrlV3);

export interface IHeader extends Document {
  headerStyle: "centered" | "left-aligned" | "right-aligned";
  headerBackgroundImage?: string;
  headerBackgroundColor: string;
}

export interface IBioPage extends Document {
  userId: string;
  slug: string;
  title: string;
  description?: string;
  avatarUrl?: string;
  avatarShape?: "circle" | "square" | "rounded";
  theme?: {
    primaryColor?: string;
    buttonTextColor?: string;
    background?: string;
    textColor?: string;
    buttonStyle?: "rounded" | "square" | "pill";
    font?: string;
    titleFontSize?: string;
    titleFontWeight?: string;
    descriptionFontSize?: string;
    descriptionFontWeight?: string;
    buttonFontSize?: string;
    buttonFontWeight?: string;
    header?: IHeader;
  };
  links: {
    link: mongoose.Types.ObjectId | IUrl;
    image?: string;
    title?: string;
    addedAt?: Date;
  }[];
  socials?: {
    url?: string;
    platform?: string;
  }[];
  socialColor: string | "original";
  createdAt: Date;
  updatedAt: Date;
}

const HeaderSchema: Schema = new Schema({
  headerStyle: {
    type: String,
    enum: ["centered", "left-aligned", "right-aligned"],
    default: "centered",
  },
  headerBackgroundImage: { type: String },
  headerBackgroundColor: { type: String, default: "#0f172b" },
});

const BioPageSchema: Schema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    slug: { type: String, required: true, unique: true },
    title: { type: String },
    description: { type: String },
    avatarUrl: { type: String },
    avatarShape: {
      type: String,
      enum: ["circle", "square", "rounded"],
      default: "circle",
    },
    theme: {
      primaryColor: { type: String },
      buttonTextColor: { type: String },
      background: { type: String },
      textColor: { type: String },
      buttonStyle: {
        type: String,
        enum: ["rounded", "square", "pill"],
        default: "rounded",
      },
      font: { type: String },
      titleFontSize: { type: String },
      titleFontWeight: { type: String },
      descriptionFontSize: { type: String },
      descriptionFontWeight: { type: String },
      buttonFontSize: { type: String },
      buttonFontWeight: { type: String },
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
        addedAt: { type: Date, default: Date.now },
      },
    ],
    socials: [
      {
        url: { type: String },
        platform: { type: String },
      },
    ],
    socialColor: { type: String, default: "original" },
  },
  { timestamps: true },
);

BioPageSchema.index({
  title: "text",
  slug: "text",
});

export const BioPage: Model<IBioPage> =
  mongoose.models.BioPage || mongoose.model<IBioPage>("BioPage", BioPageSchema);
