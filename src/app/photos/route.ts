import { NextRequest, NextResponse } from "next/server";
import { MediaItem } from "../Interfaces/MediaItem";
import { fetchFromGooglePhotosApi } from "../Utils/GooglePhotosApiUtils";
import { auth, clerkClient } from "@clerk/nextjs/server";

async function getGoogleToken() {
  const { userId } = await auth();

  const client = await clerkClient();
  const token = await client.users.getUserOauthAccessToken(
    userId || "",
    "google"
  );

  return token.data[0].token;
}

export async function GET(request: NextRequest) {
  try {
    const token = await getGoogleToken(); // Get the Google token
    const allMediaItems = await fetchFromGooglePhotosApi(token);

    console.log("Google Photos API response:", allMediaItems.length); // Log the response for debugging

    return NextResponse.json({ mediaItems: allMediaItems });
  } catch (error) {
    console.error("Error fetching photos:", error);
    return NextResponse.json(
      { error: "Failed to fetch photos", details: error.message },
      { status: 500 }
    );
  }
}
