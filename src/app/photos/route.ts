import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { MediaItem } from "../Interfaces/MediaItem";
import PrismaClient from '../lib/prisma';
import {  Prisma } from '@prisma/client'

async function getGoogleToken(userId: string) {
  const client = await clerkClient();
  const token = await client.users.getUserOauthAccessToken(
    userId || "",
    "google"
  );

  return {
    token: token.data[0].token,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    const token = await getGoogleToken(userId);
    const url =
      "https://photoslibrary.googleapis.com/v1/mediaItems?pageSize=100";
    let allMediaItems = [];
    let nextPageToken = null;

    do {
      const response = await fetch(
        nextPageToken ? `${url}&pageToken=${nextPageToken}` : url,
        {
          headers: {
            Authorization: `Bearer ${token.token}`,
            "Content-Type": "application/json",
          },
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

    const baseUrls = allMediaItems.map(({ baseUrl }: MediaItem) => baseUrl);

    console.log("Google Photos API response:", baseUrls.length); // Log the response for debugging

    const imageIds = allMediaItems.map(( item : MediaItem) => item.id)

    const user: Prisma.UserCreateManyInput = {userId, imageIds};

    await PrismaClient.user.createMany({ data: user })

    return NextResponse.json({ mediaItems: allMediaItems});
  } catch (error) {
    console.error("Error fetching photos:", error);
    return NextResponse.json(
      { error: "Failed to fetch photos", details: error.message },
      { status: 500 }
    );
  }
}
