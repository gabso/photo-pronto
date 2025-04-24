import { MediaItem } from "../Interfaces/MediaItem";
import Bottleneck from "bottleneck";

// Request limiter: 30 requests per minute
const groqLimiter = new Bottleneck({
  // maxConcurrent: 1,
  reservoir: 30,
  reservoirRefreshAmount: 30,
  reservoirRefreshInterval: 60 * 1000,
});

// Token limiter: 30,000 tokens per minute
const tokenLimiter = new Bottleneck({
  reservoir: 30000, // Start with 30,000 tokens available per minute
  reservoirRefreshAmount: 30000, // Refill 30,000 tokens every minute
  reservoirRefreshInterval: 60 * 1000, // Refresh interval: 1 minute
});

// Daily request limit (manual)
let groqDailyRequests = 0;
const GROQ_DAILY_LIMIT = 1000;
const resetGroqDailyRequests = () => { groqDailyRequests = 0; };
setInterval(resetGroqDailyRequests, 24 * 60 * 60 * 1000);

export async function executeGroqRequest(requestFn, tokensRequired) {
  try {
    // Chain the tokenLimiter with the groqLimiter to ensure both limits are respected
    return await tokenLimiter.schedule({ weight: tokensRequired }, async () => {
      return await groqLimiter.schedule(async () => {
        // Increment daily request count
        if (groqDailyRequests >= GROQ_DAILY_LIMIT) {
          throw new Error("Daily request limit exceeded.");
        }
        groqDailyRequests++;

        // Execute the request
        return await requestFn();
      });
    });
  } catch (err) {
    console.error("Error executing Groq SDK request:", err.message);
    throw new Error("Failed to execute Groq SDK request.");
  }
}

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