import * as functions from '@google-cloud/functions-framework';
import pkg from '@google-cloud/run';
import { logger } from '../lib/logger.js';
const { Jobs } = pkg;

const LOCATION = 'us-east1';
const JOB_NAME = 'doccs-sync';
const FUNCTION_NAME = 'doccsSync';

const triggerSync = async (req, res) => {
    try {
      const jobsClient = new Jobs();
      const projectId = process.env.GOOGLE_CLOUD_PROJECT;
      if (!projectId) {
        throw new Error('Unable to determine project ID');
      }

      const location = LOCATION;
      const jobName = JOB_NAME;
  
      const execution = await jobsClient.createExecution({
        parent: `projects/${projectId}/locations/${location}/jobs/${jobName}`,
      });
  
      logger.info('Started job execution', { 
        name: execution.name,
        uid: execution.uid 
      });
      
      res.status(200).send('Job started');
    } catch (error) {
      logger.error('Failed to start job:', error);
      res.status(500).send('Failed to start job');
    }
};

// Cloud Function handler
functions.http(FUNCTION_NAME, triggerSync);