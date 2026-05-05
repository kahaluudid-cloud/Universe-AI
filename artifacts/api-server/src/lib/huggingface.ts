/**
 * Hugging Face Inference API — Image generation
 * Model: black-forest-labs/FLUX.1-schnell (free tier)
 * Falls back to Replit OpenAI image gen if HF_TOKEN not set
 */

export async function generateImageHuggingFace(
  prompt: string,
  token: string
): Promise<string> {
  const MODEL = "black-forest-labs/FLUX.1-schnell";

  const res = await fetch(
    `https://api-inference.huggingface.co/models/${MODEL}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Wait-For-Model": "true",
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          num_inference_steps: 4,
          guidance_scale: 3.5,
        },
      }),
      signal: AbortSignal.timeout(60000),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    const err = new Error(`HuggingFace API error: ${errText}`);
    (err as unknown as { status: number }).status = res.status;
    throw err;
  }

  const arrayBuffer = await res.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return base64;
}
