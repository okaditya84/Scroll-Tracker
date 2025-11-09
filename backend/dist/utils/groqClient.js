import axios from 'axios';
import env from '../config/env.js';
import logger from './logger.js';
const shouldRetry = (status) => {
    if (!status) {
        return true;
    }
    if (status === 429 || status === 408) {
        return true;
    }
    return status >= 500 && status < 600;
};
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
export const callGroq = async (messages) => {
    const MAX_ATTEMPTS = 4;
    const BASE_DELAY_MS = 1000;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        try {
            const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
                messages,
                temperature: 0.9, // Increased temperature for more creative responses
                max_tokens: 600 // Increased token limit for richer insights
            }, {
                timeout: 20_000,
                headers: {
                    Authorization: `Bearer ${env.GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });
            const content = response.data?.choices?.[0]?.message?.content;
            if (!content || typeof content !== 'string' || !content.trim()) {
                throw new Error('Groq returned an empty response');
            }
            return content;
        }
        catch (error) {
            const axiosError = axios.isAxiosError(error) ? error : undefined;
            const status = axiosError?.response?.status;
            const data = axiosError?.response?.data;
            const retryable = shouldRetry(status);
            if (retryable && attempt < MAX_ATTEMPTS) {
                const delay = BASE_DELAY_MS * 2 ** (attempt - 1) + Math.floor(Math.random() * 250);
                logger.warn({ attempt, status, data }, 'Groq request failed, retrying after backoff');
                await wait(delay);
                continue;
            }
            logger.error({ attempt, status, data, error: axiosError?.message ?? error?.message }, 'Groq request failed');
            if (axiosError) {
                const message = status
                    ? `Groq API request failed with status ${status}`
                    : `Groq API request failed: ${axiosError.message}`;
                throw new Error(message);
            }
            throw error;
        }
    }
    throw new Error('Groq API request failed after maximum retry attempts');
};
