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
      model: 'openai/gpt-oss-20b',
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
