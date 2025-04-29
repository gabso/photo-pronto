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
  console.log('in executeGroqRequest')

  const MAX_RETRIES = 3; // Maximum number of retries
  const RETRY_DELAY = 2000; // Delay between retries in milliseconds

  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
      return await tokenLimiter.schedule(
        { weight: tokensRequired },
        async () => {
          console.log("Executing request with token limit:", tokensRequired); // Log before executing requestFn
          const result = await requestFn();
          return result;
        }
      );
    } catch (err) {
      console.error("Error during scheduling or execution (attempt", attempt + 1, "):", err);
      console.error("Parameters sent to requestFn on error:", tokensRequired); // Log the parameters sent to requestFn only if there's an error

      // Check if the error is a 503 Service Unavailable
      if (err.message.includes("503") && attempt < MAX_RETRIES - 1) {
        console.log("503 Service Unavailable error encountered. Retrying in", RETRY_DELAY, "ms...");
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY)); // Wait before retrying
        attempt++;
      } else {
        throw new Error("Request failed: " + err.message);
      }
    }
  }

  throw new Error("Request failed after maximum retries.");
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