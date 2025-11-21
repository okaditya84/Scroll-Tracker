import nodemailer from 'nodemailer';
import env from '../config/env.js';
import logger from './logger.js';
const createTransporter = () => nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE || env.SMTP_PORT === 465,
    pool: env.SMTP_USE_POOL,
    auth: {
        user: env.SMTP_USERNAME,
        pass: env.SMTP_PASSWORD
    },
    requireTLS: env.SMTP_REQUIRE_TLS,
    connectionTimeout: env.SMTP_CONNECTION_TIMEOUT_MS,
    socketTimeout: env.SMTP_SOCKET_TIMEOUT_MS,
    greetingTimeout: env.SMTP_GREETING_TIMEOUT_MS,
    tls: {
        rejectUnauthorized: env.SMTP_TLS_REJECT_UNAUTHORIZED,
        minVersion: 'TLSv1.2'
    },
    ...(env.SMTP_FORCE_IPV4 ? { family: 4 } : {})
});
let transporter = createTransporter();
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
        const hint = error?.code === 'ETIMEDOUT'
            ? 'SMTP connection timed out. Verify outbound access to your SMTP host, or set SMTP_FORCE_IPV4=false if your provider requires IPv6.'
            : undefined;
        logger.error({ error, hint }, 'Failed to send email');
        throw error;
    }
};
export const refreshTransporter = () => {
    transporter = createTransporter();
};
export const verifyMailer = async () => {
    try {
        await transporter.verify();
        logger.info('SMTP transport verified successfully');
    }
    catch (error) {
        logger.error({
            error,
            host: env.SMTP_HOST,
            port: env.SMTP_PORT,
            username: env.SMTP_USERNAME
        }, 'SMTP verification failed. Double-check credentials, ports, and outbound firewall rules.');
        throw error;
    }
};
