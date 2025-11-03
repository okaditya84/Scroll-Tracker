import axios from 'axios';
import env from '../config/env.js';

export type GroqMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export const callGroq = async (messages: GroqMessage[]) => {
  const response = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
      messages,
      temperature: 0.8,
      max_tokens: 512
    },
    {
      headers: {
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );

  return response.data.choices[0].message.content as string;
};
