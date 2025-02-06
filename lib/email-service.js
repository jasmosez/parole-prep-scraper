import nodemailer from 'nodemailer';
import { config } from '../config.js';
import { logger } from './logger.js';

export class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            host: config.email.smtpHost,
            port: config.email.smtpPort,
            secure: config.email.smtpSecure,
            auth: {
                user: config.email.smtpUser,
                pass: config.email.smtpPassword
            }
        });
    }

    async sendEmail({ to, subject, text }) {
        try {
            const message = {
                from: config.email.fromAddress,
                to,
                subject,
                text
            };

            const info = await this.transporter.sendMail(message);
            logger.info('Email sent successfully', { messageId: info.messageId });
            return info;
        } catch (error) {
            logger.error('Failed to send email', error);
            throw error;
        }
    }

    async sendPreconfiguredEmail(text) {
        const { staffReportTo, staffReportSubject } = config.email;
        await this.sendEmail({
            to: staffReportTo,
            subject: staffReportSubject,
            text
        });
    }
} 