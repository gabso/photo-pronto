import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";

async function getGoogleToken() {
  const { userId } = await auth();
  const client = await clerkClient();
  const token = await client.users.getUserOauthAccessToken(
    userId || "",
    "google"
  );

  return {
    token: token.data[0].token,
  };
}

interface MediaItem {
  id: string;
  productUrl: string;
  baseUrl: string;
  mimeType: string;
  mediaMetadata: {
    creationTime: string;
    width: string;
    height: string;
    photo: {
      cameraMake: string;
      cameraModel: string;
      focalLength: number;
      apertureFNumber: number;
      isoEquivalent: number;
      exposureTime: string;
    };
  };
  filename: string;
}

function modifyBaseUrlWithOriginalDimensions(mediaItem: MediaItem, width:string, height:string): string {
  // const width = mediaItem.mediaMetadata.width;
  // const height = mediaItem.mediaMetadata.height;
  let modifiedBaseUrl = mediaItem.baseUrl;

  modifiedBaseUrl += `=w${width}-h${height}`;

  return modifiedBaseUrl;
}

export async function GET(request: NextRequest) {
  try {
    const token = await getGoogleToken();
    const url = "https://photoslibrary.googleapis.com/v1/mediaItems";

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token.token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Google Photos API error: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.mediaItems || !Array.isArray(data.mediaItems)) {
      throw new Error("Invalid response from Google Photos API");
    }

        const baseUrls = data.mediaItems.map(({ baseUrl }: MediaItem) => baseUrl);

     //Maybe use in the future with paid API key   
    // const Urls = data.mediaItems.map((mediaItem: MediaItem) =>
    //   modifyBaseUrlWithOriginalDimensions(mediaItem,'1024','768')
    // );


    return NextResponse.json({ mediaItems: data.mediaItems, Urls:baseUrls });
  } catch (error) {
    console.error("Error fetching photos:", error);
    return NextResponse.json(
      { error: "Failed to fetch photos", details: error.message },
      { status: 500 }
    );
  }
}
