import { NextRequest, NextResponse } from "next/server";

import Groq from "groq-sdk";
import { executeGroqRequest } from "../Utils/ImageUtils";

type InputType = Record<string, string[]>;

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const client = new Groq({
  apiKey: GROQ_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageUrls } = body;

    if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
      return NextResponse.json(
        { error: "Invalid request. 'imageUrls' must be a non-empty array." },
        { status: 400 }
      );
    }

    const groupedImages = await groupImagesBySubject(imageUrls);
    //  console.log("groupedImages:", groupedImages);

    const bestImages = await ChooseBestImageForEachCategory(groupedImages);

    // console.log("Best Images:", bestImages);

    // Return both grouped images and best images
    return NextResponse.json(
      {
        groupedImages,
        bestImages,
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

const MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const TOKEN_COUNT = 2405


async function groupImagesBySubject(imageUrls: string[]) {
  const groups: Record<string, string[]> = {};

  const text =`For each image, generate a concise three-word description following this pattern: [main subject] [landscape type] [location name]. Examples: "dog park new york", "car street central park", "food beach venice beach".

            *   **Main subject:** Use a single, common noun to identify the primary object or person taken.
            
            *   **landscape type:** Use a single, general term describing the landscape's type (e.g., "street", "park", "beach", "shop", "building").
            
            *   **location name:** Identify the location in the image. Use the most specific name possible, such as "New York" or "Paris". Avoid vague terms like "city" or "town".
            
            Strive for consistency across all images. You'll be processing images in separate batches and won't know which words were used in the other batches.
            
            Respond *only* with a JSON array of strings, one description per image, in the order provided. Do not include any extra text or formatting.`

  for (let i = 0; i < imageUrls.length; i += 5) {
    const batch = imageUrls.slice(i, i + 5);
    const messages = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text
          },
          ...batch.map((url) => ({
            type: "image_url",
            image_url: { url },
            response_format: { type: "json_object" },
            temperature: 0,
          })),
        ],
      },
    ];




    try {
      const response = await executeGroqRequest(
        () => client.chat.completions.create({
          model: MODEL,
          messages,
        }),
        TOKEN_COUNT, // Pass the calculated token count
        messages 
      );

      // Extract and parse the JSON array from the response
      const content = response.choices[0].message.content;
      debugger;
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

   console.log('grouped image number:', i, 'of', imageUrls.length)
  }

  return groups;
}

// Simple normalization (expand as needed)
function normalizeCategory(text: string): string {
  return text.trim().toLowerCase().replace(/[^a-z0-9 ]/g, "");
}

async function ComparePhotos(imageUrls: string[]) {
  if (imageUrls.length < 2 || imageUrls.length > 5) {
    throw new Error("You must provide between 2 and 5 image URLs.");
  }

  const text=  `Analyze the following images and determine which one is the best based on angle image taken, the best spatial perception, resolution, clarity, composition, and overall quality. Respond ONLY with the index of the best image (starting from 0) in the provided list.`

  const messages = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text
        },
        ...imageUrls.map((url) => ({
          type: "image_url",
          image_url: {
            detail: "high",
            url,
          },
        })),
      ],
    },
  ];


  const chatCompletion = await executeGroqRequest(
    () => client.chat.completions.create({
      messages,
      model: MODEL,
      temperature: 0
    }),
    TOKEN_COUNT,  // Pass the calculated token count
    messages 
  );

  const bestImageIndex = parseInt(chatCompletion.choices[0].message.content, 10);
  if (isNaN(bestImageIndex) || bestImageIndex < 0 || bestImageIndex >= imageUrls.length) {
    throw new Error("Invalid response from Groq API: " + chatCompletion.choices[0].message.content);
  }

  return imageUrls[bestImageIndex];
}

async function ChooseBestImageForEachCategory(input: InputType) {
  const bestImagePerCategory: Record<string, string[]> = {};

  for (const [key, list] of Object.entries(input)) {
    if (list.length === 1) {
      bestImagePerCategory[key] = list;
    } else if (list.length > 5) {
      let currentBatch = [...list];
      let safetyCounter = 0;

      while (currentBatch.length > 1 && safetyCounter < 10) {
        const chunks: string[][] = [];
        
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

          console.log('compared image number:', i, 'of', currentBatch.length)

        }

        // Process chunks with error handling
        const results = await Promise.allSettled(
          chunks.map(chunk => {
            console.log(`Processing chunk of ${chunk.length} images for ${key}`);
            return ComparePhotos(chunk);
          })
        );

        currentBatch = results.reduce<string[]>((acc, result) => {
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
      } catch (err) {
        console.error(`Error processing category ${key}:`, err);
        bestImagePerCategory[key] = [];
      }
    }
  }

  return bestImagePerCategory;
}