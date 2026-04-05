/// <reference types="@cloudflare/workers-types" />
import type { DriveEnv } from './_shared/google-drive';

type Env = DriveEnv;

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const apiKey = context.env.GEMINI_API_KEY || (context.env as any).VITE_GEMINI_API_KEY;

        if (!apiKey) {
            return Response.json({ success: false, error: "GEMINI_API_KEY is missing on server" }, { status: 500 });
        }

        const data = await context.request.json() as { prompt: string; base64Data: string; mimeType: string };
        const { prompt, base64Data, mimeType } = data;

        const payload = {
            contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64Data } }] }],
            generationConfig: { temperature: 0.0 }
        };

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API error ${response.status}: ${errorText}`);
        }

        const responseData = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
        const textOutput = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

        if (textOutput) {
            const cleanedText = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
            const extractedJson = JSON.parse(cleanedText);
            return Response.json({ success: true, data: extractedJson });
        } else {
            throw new Error("No data returned from AI.");
        }
    } catch (error) {
        return Response.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
};
