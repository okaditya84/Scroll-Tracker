import nodemailer from 'nodemailer';
import env from '../config/env.js';
import logger from './logger.js';
let transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
        user: env.SMTP_USERNAME,
        pass: env.SMTP_PASSWORD
    }
});
export const sendMail = async ({ to, subject, text, html }) => {
    try {
        await transporter.sendMail({
            from: {
                name: env.SMTP_FROM_NAME,
                address: env.SMTP_FROM_EMAIL
            },
            to,
            subject,
            text,
            html
        });
    }
    catch (error) {
        logger.error({ error }, 'Failed to send email');
        throw error;
    }
};
export const refreshTransporter = () => {
    transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: {
            user: env.SMTP_USERNAME,
            pass: env.SMTP_PASSWORD
        }
    });
};
