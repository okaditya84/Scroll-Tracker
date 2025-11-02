import createServer from './app.js';
import connectDb from './config/db.js';
import env from './config/env.js';
import registerJobs from './jobs/index.js';
import logger from './utils/logger.js';
const start = async () => {
    try {
        await connectDb();
        const app = createServer();
        registerJobs();
        app.listen(env.PORT, () => {
            logger.info(`Server listening on port ${env.PORT}`);
        });
    }
    catch (error) {
        logger.error({ error }, 'Failed to start server');
        process.exit(1);
    }
};
void start();
