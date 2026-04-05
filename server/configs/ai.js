class GroqAI {
  constructor(apiKey, baseURL) {
    this.apiKey = apiKey;
    this.baseURL = baseURL;

    this.chat = {
      completions: {
        create: async (options) => {
          const response = await fetch(`${this.baseURL}/chat/completions`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(options),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Groq API error: ${response.status} ${response.statusText} - ${errorText}`);
          }

          return await response.json();
        },
      },
    };
  }
}

const GROQ_API_URL = process.env.GROQ_API_URL || "https://api.groq.com/openai/v1";
const ai = new GroqAI(process.env.GROQ_API_KEY, GROQ_API_URL);

export default ai;