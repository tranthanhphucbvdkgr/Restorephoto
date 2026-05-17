import { GoogleGenAI } from "@google/genai";
import { ImageFile } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = 'gemini-2.5-flash-image';

export const restoreImage = async (
  image: ImageFile,
  style: 'vibrant' | 'natural'
): Promise<string> => {
  const prompt = style === 'vibrant'
    ? "Restore this old, damaged photo. Enhance details, remove scratches and noise. Colorize it with fresh, vivid, and vibrant colors. Make the image sharp and clear."
    : "Restore this old, damaged photo. Enhance details, remove scratches and noise. Colorize it with realistic, natural, and authentic colors. Make the image sharp and clear.";

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: image.mimeType,
              data: image.data,
            },
          },
          { text: prompt },
        ],
      },
    });

    // Iterate through parts to find the image
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return part.inlineData.data;
        }
      }
    }

    throw new Error("No image data found in response");
  } catch (error) {
    console.error(`Error generating ${style} image:`, error);
    throw error;
  }
};

export const editImage = async (
  imageData: string,
  mimeType: string,
  editPrompt: string,
  point?: { x: number, y: number } // Normalized 0-1000
): Promise<string> => {
  try {
    const locationContext = point 
      ? ` Focusing on the specific area at coordinates x: ${point.x}, y: ${point.y} (on a scale of 0 to 1000).`
      : "";

    const finalPrompt = `Task: Edit this image based on the following instruction.
Instruction: ${editPrompt}${locationContext}
Maintain the overall style, lighting, and consistency of the original image. Return ONLY the edited image data.`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: imageData,
            },
          },
          { text: finalPrompt },
        ],
      },
    });

    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return part.inlineData.data;
        }
      }
    }
    throw new Error("Không nhận được dữ liệu ảnh từ AI.");
  } catch (error) {
    console.error("Error editing image:", error);
    throw error;
  }
};
