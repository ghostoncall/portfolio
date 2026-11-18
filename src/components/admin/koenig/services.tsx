/* eslint-disable react-refresh/only-export-components -- editor service provider and its hooks share one integration boundary */
import { createContext, useContext, type ReactNode } from "react";
import { fetchEmbedData } from "@/lib/server-fns";
import { useMediaUpload } from "@/lib/media-upload";

export type UploadResult = { url: string; fileName?: string };
export type FileUpload = {
  upload(files: File[] | FileList): Promise<UploadResult[] | null>;
  isLoading: boolean;
  progress: number;
  errors: { message: string }[];
  filesNumber: number;
};
export type KoenigServices = {
  useFileUpload(type?: string): FileUpload;
  resolveEmbed(url: string, options?: { type?: string }): Promise<Record<string, unknown>>;
};
const ServicesContext = createContext<KoenigServices | null>(null);
const resolveEmbed: KoenigServices["resolveEmbed"] = (url, options = {}) =>
  (fetchEmbedData as unknown as (args: { data: unknown }) => Promise<Record<string, unknown>>)({
    data: { url, type: options.type },
  });

export function KoenigServicesProvider({
  value,
  children,
}: {
  value: KoenigServices;
  children: ReactNode;
}) {
  return <ServicesContext.Provider value={value}>{children}</ServicesContext.Provider>;
}
export function useKoenigServices(): KoenigServices {
  const provided = useContext(ServicesContext);
  const useFileUpload = useMediaUpload();
  return provided ?? { useFileUpload, resolveEmbed };
}

export function imageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = window.setTimeout(() => {
      image.src = "";
      reject(new Error("The image could not be loaded. Check its URL."));
    }, 12000);
    image.onload = () => {
      window.clearTimeout(timer);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error("The image could not be loaded. Check its URL."));
    };
    image.src = src;
  });
}

/** Read a replacement file locally so old duration/dimensions cannot follow it. */
export function mediaFileMetadata(
  file: File,
  type: "audio" | "video",
): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const media = document.createElement(type),
      src = URL.createObjectURL(file);
    const finish = (loaded: boolean) => {
      window.clearTimeout(timer);
      const fields: Record<string, unknown> = {
        mimeType: file.type,
        duration: loaded && Number.isFinite(media.duration) ? media.duration : 0,
      };
      if (type === "video")
        Object.assign(fields, {
          fileName: file.name,
          width: loaded ? (media as HTMLVideoElement).videoWidth : null,
          height: loaded ? (media as HTMLVideoElement).videoHeight : null,
          thumbnailSrc: "",
          thumbnailWidth: null,
          thumbnailHeight: null,
        });
      media.onloadedmetadata = null;
      media.onerror = null;
      media.removeAttribute("src");
      media.load();
      URL.revokeObjectURL(src);
      resolve(fields);
    };
    const timer = window.setTimeout(() => finish(false), 5000);
    media.onloadedmetadata = () => finish(true);
    media.onerror = () => finish(false);
    media.preload = "metadata";
    media.src = src;
  });
}
