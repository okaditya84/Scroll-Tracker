import axios from 'axios';
import env from '../config/env.js';
import logger from './logger.js';
const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';
export const sendMail = async ({ to, subject, text, html }) => {
    try {
        await axios.post(BREVO_ENDPOINT, {
            sender: {
                email: env.BREVO_FROM_EMAIL,
                name: env.BREVO_FROM_NAME
            },
            to: [{ email: to }],
            subject,
            textContent: text,
            htmlContent: html ?? `<p>${text}</p>`
        }, {
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'api-key': env.BREVO_API_KEY
            },
            timeout: env.BREVO_TIMEOUT_MS
        });
    }
    catch (error) {
        if (axios.isAxiosError(error)) {
            logger.error({
                status: error.response?.status,
                data: error.response?.data
            }, 'Failed to send email via Brevo');
        }
        else {
            logger.error({ error }, 'Failed to send email via Brevo');
        }
        throw error;
    }
};
