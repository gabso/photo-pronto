import { MediaItem } from "../Interfaces/MediaItem";

async function generateHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}
export async function fetchFromGooglePhotosApi(
  token: string
): Promise<MediaItem[]> {
  const url = "https://photoslibrary.googleapis.com/v1/mediaItems?pageSize=100";
  let allMediaItems = [];
  let nextPageToken = null;

  do {
    const response = await fetch(
      nextPageToken ? `${url}&pageToken=${nextPageToken}` : url,
      {
        headers: await generateHeaders(token),
      }
    );

    if (!response.ok) {
      throw new Error(`Google Photos API error: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.mediaItems || !Array.isArray(data.mediaItems)) {
      throw new Error("Invalid response from Google Photos API");
    }

    allMediaItems = allMediaItems.concat(data.mediaItems);
    nextPageToken = data.nextPageToken;
  } while (nextPageToken);

  return allMediaItems;
}

export async function fetchBaseUrlFromGoogleLibraryApi(
  imageId: string,
  token: string
): Promise<{ baseUrl: string }> {
  console.log("in fetchBaseUrlFromGoogleLibraryApi");
  const GOOGLE_LIBRARY_API_URL = `https://photoslibrary.googleapis.com/v1/mediaItems/${imageId}`;

  const response = await fetch(GOOGLE_LIBRARY_API_URL, {
    headers: await generateHeaders(token),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch image details for ID ${imageId}: ${response.statusText}`
    );
  }

  const data = await response.json();
  return { baseUrl: data.baseUrl };
}

export async function fetchBaseUrlsInBatches(
  imageIds: string[],
  token: string,
  batchSize: number = 50
): Promise<{ id: string; baseUrl: string }[]> {
  console.log("in fetchBaseUrlsInBatches");

  const GOOGLE_LIBRARY_API_URL =
    "https://photoslibrary.googleapis.com/v1/mediaItems:batchGet";
  const results: { id: string; baseUrl: string }[] = [];

  // Split imageIds into batches
  for (let i = 0; i < imageIds.length; i += batchSize) {
    const batch = imageIds.slice(i, i + batchSize);

    // Construct query parameters for the batch
    const queryParams = batch.map((id) => `mediaItemIds=${encodeURIComponent(id)}`).join('&');
    const urlWithParams = `${GOOGLE_LIBRARY_API_URL}?${queryParams}`;

    const response = await fetch(urlWithParams, {
      method: "GET",
      headers: await generateHeaders(token),
    });

    if (!response.ok) {
      console.error("Error in fetchBaseUrlsInBatches:", JSON.stringify(response));
      throw new Error(`Failed to fetch batch: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.mediaItemResults || !Array.isArray(data.mediaItemResults)) {
      throw new Error("Invalid response from Google Photos API");
    }

    // Extract id and baseUrl from the response
    const batchResults = data.mediaItemResults.map((result: any) => {
      if (result.mediaItem && result.mediaItem.id && result.mediaItem.baseUrl) {
        return { id: result.mediaItem.id, baseUrl: result.mediaItem.baseUrl };
      } else {
        throw new Error(
          `Invalid media item in batch response: ${JSON.stringify(result)}`
        );
      }
    });

    results.push(...batchResults);
  }

  return results;
}
