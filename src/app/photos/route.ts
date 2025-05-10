import { NextRequest, NextResponse } from "next/server";
import { MediaItem } from "../Interfaces/MediaItem";
import { fetchFromGoogleDriveApi, fetchImagesInDriveFolder } from "../Utils/GooglePhotosApiUtils";
import { auth, clerkClient } from "@clerk/nextjs/server";
import NodeCache from "node-cache";

const cache = new NodeCache({ stdTTL: 3600 }); // Cache with 60 minutes TTL

async function getGoogleToken() {
  const { userId } = await auth();

  const client = await clerkClient();
  const token = await client.users.getUserOauthAccessToken(
    userId || "",
    "google"
  );

  return token.data[0].token;
}

// export async function GET(request: NextRequest) {
//   try {

//     const { userId } = await auth();

//     const cacheKey = `allMediaItems_${userId}`; // Unique cache key for each user

//     // Check if results are cached
//     const cachedMediaItems = cache.get(cacheKey);
//     if (cachedMediaItems) {
//       return NextResponse.json({ mediaItems: cachedMediaItems });
//     }

//     const token = await getGoogleToken(); // Get the Google token
//     const allMediaItems = await fetchFromGooglePhotosApi(token);

//     console.log("Google Photos API response:", allMediaItems.length); // Log the response for debugging

//     // Cache the results
//     cache.set(cacheKey, allMediaItems);

//     return NextResponse.json({ mediaItems: allMediaItems });
//   } catch (error) {
//     console.error("Error fetching photos:", error);
//     return NextResponse.json(
//       { error: "Failed to fetch photos", details: error.message },
//       { status: 500 }
//     );
//   }
// }

export async function GET(request: NextRequest) {
  try {

    const { userId } = await auth();

    const cacheKey = `allMediaItems_${userId}`; // Unique cache key for each user

    // Check if results are cached
    const cachedMediaItems = cache.get(cacheKey);
    if (cachedMediaItems) {
      return NextResponse.json({ mediaItems: cachedMediaItems });
    }

    const token = await getGoogleToken(); // Get the Google token
    const allMediaItems = await fetchImagesInDriveFolder(token,'1wNGMDNNn5wzFY7SGQRDFLAGFM--RWnqK');

    console.log("Google Photos API response:", allMediaItems.length); // Log the response for debugging

    // Cache the results
    cache.set(cacheKey, allMediaItems);

    return NextResponse.json({ mediaItems: allMediaItems });
  } catch (error) {
    console.error("Error fetching photos:", error);
    return NextResponse.json(
      { error: "Failed to fetch photos", details: error.message },
      { status: 500 }
    );
  }
}
