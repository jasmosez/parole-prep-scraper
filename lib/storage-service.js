import { Storage } from '@google-cloud/storage';
import { logger } from './logger.js';

export class StorageService {
    constructor(bucketName) {
        this.storage = new Storage();
        this.bucketName = bucketName;
        this.bucket = this.storage.bucket(bucketName);
    }

    async saveFile(path, content, options = {}) {
        try {
            const file = this.bucket.file(path);
            const metadata = {
                contentType: this.getContentType(path),
                metadata: {
                    createdAt: new Date().toISOString(),
                    ...options.metadata
                },
                ...options
            };

            await file.save(content, metadata);
            logger.info(`File saved to gs://${this.bucketName}/${path}`);
        } catch (error) {
            logger.error('Failed to save file to storage', error, { path });
            throw error;
        }
    }

    getContentType(filename) {
        const extension = filename.split('.').pop().toLowerCase();
        const contentTypes = {
            'json': 'application/json',
            'txt': 'text/plain',
        };
        return contentTypes[extension] || 'application/octet-stream';
    }

    async saveReports(report, environment) {
        const date = new Date().toISOString();
        const metadata = { environment };

        // Save JSON report
        const jsonReport = {
            ...report,
            networkAnalysis: report.getNetworkAnalysis()
        };
        await this.saveFile(
            `reports/${environment}-${date}-report.json`,
            JSON.stringify(jsonReport, null, 2),
            { metadata }
        );

        // Save text report
        await this.saveFile(
            `staff-reports/${environment}-${date}-staff-report.txt`,
            report.getTextReport(),
            { metadata }
        );
    }
} 