import OpenAI from "openai";

const ai = new OpenAI({
    apiKey: process.env.GROK_API_KEY,       // uses Grok API key from .env
    baseURL: process.env.GROK_API_URL,      // uses Grok base URL from .env
});

export default ai;