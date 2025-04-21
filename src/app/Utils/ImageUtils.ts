import { MediaItem } from "../Interfaces/MediaItem";

export function modifyBaseUrlWithOriginalDimensions(mediaItem: MediaItem, width?: string, height?: string): string {
  const finalWidth = width || mediaItem.mediaMetadata.width;
  const finalHeight = height || mediaItem.mediaMetadata.height;
  let modifiedBaseUrl = mediaItem.baseUrl;

  modifiedBaseUrl += `=w${finalWidth}-h${finalHeight}`;

  return modifiedBaseUrl;
}

export function modifyBaseUrlWithOriginalDimensionsUrl(url: string, width?: string, height?: string): string {

  let modifiedBaseUrl = url;

  modifiedBaseUrl += `=w${width}-h${height}`;

  return modifiedBaseUrl;
}