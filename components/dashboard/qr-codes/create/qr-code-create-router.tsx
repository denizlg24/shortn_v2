"use client";

import { useState } from "react";
import { QRCodeCreate } from "./qr-code-create";

import { TUrl } from "@/models/url/UrlV3";
import { QRCodeAttach } from "./qr-code-attatch";

export const QRCodeCreateRouter = ({ link }: { link: TUrl | undefined }) => {
  const [state, setState] = useState<
    "configure" | "customize" | "attachToLink" | undefined
  >(link ? "attachToLink" : "configure");

  switch (state) {
    case "configure":
      return <QRCodeCreate state="configure" setState={setState} />;
    case "customize":
      return <QRCodeCreate state="customize" setState={setState} />;
    case "attachToLink":
      return <QRCodeAttach linkToAttach={link!} />;
  }
};
