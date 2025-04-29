import { MediaItem } from "../Interfaces/MediaItem";


async function generateHeaders(token: string) {

  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}
export async function fetchFromGooglePhotosApi(token:string): Promise<MediaItem[]> {

  const url =
    "https://photoslibrary.googleapis.com/v1/mediaItems?pageSize=25";
  let allMediaItems = [];
  let nextPageToken = null;

  do {
    const response = await fetch(
      nextPageToken ? `${url}&pageToken=${nextPageToken}` : url,
      {
        headers: await generateHeaders(token)
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
  } while (!nextPageToken);


  return allMediaItems
}


export async function fetchBaseUrlFromGoogleLibraryApi(imageId: string, token: string): Promise<{ baseUrl: string }> {
  console.log('in fetchBaseUrlFromGoogleLibraryApi')
  const GOOGLE_LIBRARY_API_URL = `https://photoslibrary.googleapis.com/v1/mediaItems/${imageId}`;

  const response = await fetch(GOOGLE_LIBRARY_API_URL, {
    headers: await generateHeaders(token)

  });

  if (!response.ok) {
    throw new Error(`Failed to fetch image details for ID ${imageId}: ${response.statusText}`);
  }

  const data = await response.json();
  return { baseUrl: data.baseUrl };
}