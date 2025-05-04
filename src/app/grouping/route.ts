import { NextRequest, NextResponse } from "next/server";

import Groq from "groq-sdk";
import { executeGroqRequest } from "../Utils/ImageUtils";
import { MediaItem } from "../Interfaces/MediaItem";
import prisma from "../lib/prisma";
import { fetchBaseUrlsInBatches } from "../Utils/GooglePhotosApiUtils";

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

type InputType = Record<string, MediaItem[]>;

const GROQ_API_KEY = process.env.GROQ_API_KEY2;
const client = new Groq({
  apiKey: GROQ_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const mediaItems: MediaItem[] = body.mediaItems;

    const { userId } = await auth();
    const { groupedImages, bestImages } = await categorizeAndDetermineBestImage(
      userId,
      mediaItems
    );


    const totalImages = Object.values(groupedImages).reduce((sum, images) => sum + images.length, 0);
    console.log('Total images of all categories:', totalImages);

    let imagesRefined = 0;
    const refinedResults: {
      groupedImages: Record<string, MediaItem[]>;
      bestImages: Record<string, MediaItem[]>;
    } = { groupedImages: {}, bestImages: {} };
    for (const [categoryName, images] of Object.entries(groupedImages)) {
      imagesRefined += images.length;
      console.log("imagesRefined:", imagesRefined);
      if (images.length < 5) {
        refinedResults.groupedImages[categoryName] = images; // Keep the original images if less than 5
        refinedResults.bestImages[categoryName] =
          bestImages[categoryName] || []; // Keep the original best images if less than 5
        continue;
      }

      console.log("Refining category:", categoryName, "with images:", images.length);

      const refinedImages = await refineAndRegroupImages(images);

      for (const [categoryName, images] of Object.entries(
        refinedImages.groupedImages
      )) {
        if (!refinedResults.groupedImages[categoryName]) {
          refinedResults.groupedImages[categoryName] = [];
        }
        refinedResults.groupedImages[categoryName].push(...images);
      }

      for (const [categoryName, images] of Object.entries(
        refinedImages.bestImages
      )) {
        if (!refinedResults.bestImages[categoryName]) {
          refinedResults.bestImages[categoryName] = [];
        }
        refinedResults.bestImages[categoryName].push(...images);
      }
    }

    console.log("Refined Results:", JSON.stringify(refinedResults)); // Log the refined results for debugging

    // console.log("Best Images:", bestImages);

    // Return both grouped images and best images
    const groupedImagesBaseUrls: Record<string, string[]> = {};
    const bestImagesBaseUrls: Record<string, string[]> = {};

    for (const [key, mediaItems] of Object.entries(groupedImages)) {
      groupedImagesBaseUrls[key] = mediaItems.map((item) => item.baseUrl);
    }

    for (const [key, mediaItems] of Object.entries(bestImages)) {
      bestImagesBaseUrls[key] = mediaItems.map((item) => item.baseUrl);
    }

    // Store refinedResults in the DB under the refinedCategory model
    for (const [categoryName, images] of Object.entries(refinedResults.groupedImages)) {
      const existingCategory = await prisma.refinedCategory.findUnique({
        where: { name: categoryName },
      });

      if (existingCategory) {
        // Update the category with new image IDs
        await prisma.refinedCategory.update({
          where: { name: categoryName },
          data: {
            imageIds: Array.from(
              new Set([
                ...existingCategory.imageIds,
                ...images.map((img) => img.id),
              ])
            ),
            bestImageId: refinedResults.bestImages[categoryName]?.[0]?.id || null,
          },
        });
      } else {
        // Create a new category with the refined results
        await prisma.refinedCategory.create({
          data: {
            userId,
            name: categoryName,
            imageIds: images.map((img) => img.id),
            bestImageId: refinedResults.bestImages[categoryName]?.[0]?.id || null,
          },
        });
      }
    }

    return NextResponse.json(
      {
        groupedImages: groupedImagesBaseUrls,
        bestImages: bestImagesBaseUrls,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error processing request:", error);
    return NextResponse.json(
      { error: "Failed to process request", details: error.message },
      { status: 500 }
    );
  }
}

async function categorizeAndDetermineBestImage(
  userId: string,
  mediaItems: MediaItem[]
) {
  const cacheKey = `categorizeAndDetermineBestImage_${userId}`;

  // Check if results are cached
  const cachedResults = cache.get(cacheKey);
  if (cachedResults) {
    return cachedResults;
  }

  const token = await getGoogleToken(); // Get the Google token
  // Check if there are categories for the current userId in the DB
  const categories = await prisma.category.findMany({
    where: { userId },
  });

  const existingGroupedImages: Record<string, MediaItem[]> = {};
  const existingBestImages: Record<string, MediaItem[]> = {};

  // Flatten all categories and get the image base URLs at once
  const allImageIds = categories.flatMap((category) => category.imageIds);

  console.log("allImageIds:", allImageIds); // Log the image IDs for debugging
  const allMediaItems = await fetchBaseUrlsInBatches(allImageIds, token);

  // Create a map of imageId to baseUrl for quick lookup
  const imageIdToBaseUrl = new Map(
    allMediaItems.map((item) => [item.id, item.baseUrl])
  );

  // Assign the baseUrls to the images of each category accordingly
  for (const category of categories) {
    existingGroupedImages[category.name] = category.imageIds.map((id) => ({
      id,
      baseUrl: imageIdToBaseUrl.get(id) || "",
    }));

    if (category.bestImageId) {
      const bestImageBaseUrl = imageIdToBaseUrl.get(category.bestImageId);
      if (bestImageBaseUrl) {
        existingBestImages[category.name] = [
          {
            id: category.bestImageId,
            baseUrl: bestImageBaseUrl,
          },
        ];
      }
    }
  }

  // Remove existing image IDs from the mediaItems list
  const existingImageIds = new Set(
    categories.flatMap((category) => category.imageIds)
  );

  const filteredMediaItems = mediaItems.filter(
    (item) => !existingImageIds.has(item.id)
  );
  let groupedImages: Record<string, MediaItem[]> = {};
  let bestImages: Record<string, MediaItem[]> = {};
  if (filteredMediaItems.length > 0) {
    // Call groupImagesBySubject with the filtered media items
    groupedImages = await groupImagesBySubject(filteredMediaItems);

    // Call ChooseBestImageForEachCategory with the grouped images
    bestImages = await ChooseBestImageForEachCategory(groupedImages);

    // Store groupedImages and bestImages in the DB
    for (const [categoryName, images] of Object.entries(groupedImages)) {
      const bestImage = bestImages[categoryName]?.[0]?.id || null;

      // Create or update the category in the database
      const existingCategory = await prisma.category.findUnique({
        where: { name: categoryName },
      });

      if (existingCategory) {
        // Update the category with new image IDs from filteredMediaItems
        await prisma.category.update({
          where: { name: categoryName },
          data: {
            imageIds: Array.from(
              new Set([
                ...existingCategory.imageIds,
                ...images.map((img) => img.id),
              ])
            ),
            bestImageId: bestImage,
          },
        });
      } else {
        // Create a new category with the filtered media items
        await prisma.category.create({
          data: {
            userId,
            name: categoryName,
            imageIds: images.map((img) => img.id),
            bestImageId: bestImage,
          },
        });
      }
    }
  }

  // Merge groupedImages with existingGroupedImages
  for (const [categoryName, images] of Object.entries(groupedImages)) {
    if (!existingGroupedImages[categoryName]) {
      existingGroupedImages[categoryName] = [];
    }

    const uniqueImages = Array.from(
      new Set([
        ...existingGroupedImages[categoryName].map((img) => img.id),
        ...images.map((img) => img.id),
      ])
    ).map((id) => {
      return (
        images.find((img) => img.id === id) ||
        existingGroupedImages[categoryName].find((img) => img.id === id)
      );
    }) as MediaItem[];

    existingGroupedImages[categoryName] = uniqueImages;
  }

  // Merge bestImages with existingBestImages
  for (const [categoryName, images] of Object.entries(bestImages)) {
    if (!existingBestImages[categoryName]) {
      existingBestImages[categoryName] = [];
    }

    const uniqueBestImages = Array.from(
      new Set([
        ...existingBestImages[categoryName].map((img) => img.id),
        ...images.map((img) => img.id),
      ])
    ).map((id) => {
      return (
        images.find((img) => img.id === id) ||
        existingBestImages[categoryName].find((img) => img.id === id)
      );
    }) as MediaItem[];

    existingBestImages[categoryName] = uniqueBestImages;
  }

  // Cache the results
  const results = {
    groupedImages: existingGroupedImages,
    bestImages: existingBestImages,
  };
  cache.set(cacheKey, results);

  // Return the merged results
  return results;
}

const MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const TOKEN_COUNT = 2405;

async function groupImagesBySubject(mediaItems: MediaItem[]) {
  const groups: Record<string, MediaItem[]> = {};

  const text = `For each image, generate a concise three-word description following this pattern: [main subject] [landscape type] [location name]. Examples: "dog park new york", "car street central park", "food beach venice beach".

            *   **Main subject:** Use a single, common noun to identify the primary object or person taken.
            
            *   **landscape type:** Use a single, general term describing the landscape's type (e.g., "street", "park", "beach", "shop", "building").
            
            *   **location name:** Identify the location in the image. Use the most specific name possible, such as "New York" or "Paris". Avoid vague terms like "city" or "town".
            
            Strive for consistency across all images. You'll be processing images in separate batches and won't know which words were used in the other batches.
            
            Respond *only* with a JSON array of strings, one description per image, in the order provided. Do not include any extra text or formatting.`;

  for (let i = 0; i < mediaItems.length; i += 5) {
    const batch = mediaItems.slice(i, i + 5);
    const messages = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text,
          },
          ...batch.map((mediaItem) => ({
            type: "image_url",
            image_url: { url: mediaItem.baseUrl },
            response_format: { type: "json_object" },
            temperature: 0,
          })),
        ],
      },
    ];

    try {
      const response = await executeGroqRequest(
        () =>
          client.chat.completions.create({
            model: MODEL,
            messages,
          }),
        TOKEN_COUNT // Pass the calculated token count
      );

      // Extract and parse the JSON array from the response
      const content = response.choices[0].message.content;
      const jsonMatch = content.match(/\[.*\]/s); // extract JSON array from response
      if (!jsonMatch) {
        console.error("No JSON array found in response:", content);
        continue;
      }
      const labels: string[] = JSON.parse(jsonMatch[0]);

      // Group images by normalized label
      labels.forEach((label, idx) => {
        const category = normalizeCategory(label);
        const imgUrl = batch[idx];
        if (!groups[category]) groups[category] = [];
        groups[category].push(imgUrl);
      });
    } catch (err) {
      console.error("Batch error:", err);
    }

    console.log("grouped image number:", i, "of", mediaItems.length);
  }

  return groups;
}

// Simple normalization (expand as needed)
function normalizeCategory(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "");
}

async function ComparePhotos(mediaItems: MediaItem[]) {
  if (mediaItems.length < 2 || mediaItems.length > 5) {
    throw new Error("You must provide between 2 and 5 image URLs.");
  }

  const text = `Analyze the following images and determine which one is the best based on angle image taken, the best spatial perception, resolution, clarity, composition, and overall quality. Respond ONLY with the index of the best image (starting from 0) in the provided list.`;

  const messages = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text,
        },
        ...mediaItems.map((mediaItem) => ({
          type: "image_url",
          image_url: {
            detail: "high",
            url: mediaItem.baseUrl,
          },
        })),
      ],
    },
  ];

  const chatCompletion = await executeGroqRequest(
    () =>
      client.chat.completions.create({
        messages,
        model: MODEL,
        temperature: 0,
      }),
    TOKEN_COUNT // Pass the calculated token count
  );

  const bestImageIndex = parseInt(
    chatCompletion.choices[0].message.content,
    10
  );
  if (
    isNaN(bestImageIndex) ||
    bestImageIndex < 0 ||
    bestImageIndex >= mediaItems.length
  ) {
    throw new Error(
      "Invalid response from Groq API: " +
        chatCompletion.choices[0].message.content
    );
  }

  return mediaItems[bestImageIndex];
}

async function ChooseBestImageForEachCategory(input: InputType) {
  const bestImagePerCategory: Record<string, MediaItem[]> = {};

  for (const [key, list] of Object.entries(input)) {
    if (list.length === 1) {
      bestImagePerCategory[key] = list;
    } else if (list.length > 5) {
      let currentBatch = [...list];
      let safetyCounter = 0;

      while (currentBatch.length > 1 && safetyCounter < 10) {
        const chunks: MediaItem[][] = [];

        // Create chunks of 2-5 images
        for (let i = 0; i < currentBatch.length; i += 5) {
          let chunk = currentBatch.slice(i, i + 5);

          // Redistribute if final chunk has <2 images
          if (chunks.length > 0 && chunk.length < 2) {
            const lastChunk = chunks[chunks.length - 1];
            const moved = lastChunk.splice(-1);
            chunk = [...moved, ...chunk];
          }

          if (chunk.length >= 2) {
            chunks.push(chunk);
          }
        }

        // Process chunks with error handling
        const results = await Promise.allSettled(
          chunks.map((chunk) => {
            console.log(
              `Processing chunk of ${chunk.length} images for ${key}`
            );
            return ComparePhotos(chunk);
          })
        );

        currentBatch = results.reduce<MediaItem[]>((acc, result) => {
          if (result.status === "fulfilled" && result.value) {
            acc.push(result.value);
          }
          return acc;
        }, []);

        safetyCounter++;
        if (currentBatch.length === 0) break;
      }

      bestImagePerCategory[key] = currentBatch[0] ? [currentBatch[0]] : [];
    } else {
      try {
        const bestImage = await ComparePhotos(list);
        bestImagePerCategory[key] = bestImage ? [bestImage] : [];

        console.log("compared category:", key);
      } catch (err) {
        console.error(`Error processing category ${key}:`, err);
        bestImagePerCategory[key] = [];
      }
    }
  }

  return bestImagePerCategory;
}

async function refineAndRegroupImages(mediaItems: MediaItem[]) {
  let groupedImages = await groupImagesBySubject(mediaItems);

  // Step 1: Refine overly broad categories
  for (const [category, images] of Object.entries(groupedImages)) {
    if (images.length >= 5) {
      // Example threshold for overly broad categories
      const refinedGroups = await groupImagesBySubject(images);
      delete groupedImages[category];
      Object.assign(groupedImages, refinedGroups);
    }
  }

  // Step 2: Choose the best image for each refined category
  const bestImages = await ChooseBestImageForEachCategory(groupedImages);

  // Step 3: Recheck best images across categories
  const bestImageList = Object.values(bestImages).flat();
  const regroupedBestImages = await groupImagesBySubject(bestImageList);

  // Step 4: Merge regrouped best images back into groupedImages
  for (const [category, images] of Object.entries(regroupedBestImages)) {
    if (!groupedImages[category]) {
      groupedImages[category] = [];
    }
    groupedImages[category].push(...images);

    console.log('broad category:', category, 'images:', images.length);
  }

  // Step 5: Re-run ChooseBestImageForEachCategory on the final groups
  const finalBestImages = await ChooseBestImageForEachCategory(groupedImages);

  


  return { groupedImages, bestImages: finalBestImages };
}
