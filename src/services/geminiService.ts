import { GoogleGenAI } from "@google/genai";

export const getGeminiResponse = async (prompt: string, userLocation?: { lat: number; lng: number }) => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const config: any = {
    tools: [{ googleMaps: {} }],
  };

  if (userLocation) {
    config.toolConfig = {
      retrievalConfig: {
        latLng: {
          latitude: userLocation.lat,
          longitude: userLocation.lng,
        },
      },
    };
  }

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config,
  });

  return response;
};
