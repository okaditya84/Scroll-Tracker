import createServer from './app.js';
import connectDb from './config/db.js';
import env from './config/env.js';
import registerJobs from './jobs/index.js';
import logger from './utils/logger.js';
import User from './models/User.js';
import bcrypt from 'bcryptjs';
const start = async () => {
    try {
        await connectDb();
        // seed a superadmin user when credentials are provided
        if (env.SUPERADMIN_EMAIL && env.SUPERADMIN_PASSWORD) {
            const email = env.SUPERADMIN_EMAIL.toLowerCase().trim();
            const existing = await User.findOne({ email });
            if (!existing) {
                const passwordHash = await bcrypt.hash(env.SUPERADMIN_PASSWORD, 12);
                await User.create({ email, passwordHash, displayName: 'Super Admin', role: 'superadmin' });
                logger.info('Superadmin seeded from environment');
            }
            else if (existing.role !== 'superadmin') {
                existing.role = 'superadmin';
                if (!existing.passwordHash) {
                    existing.passwordHash = await bcrypt.hash(env.SUPERADMIN_PASSWORD, 12);
                }
                await existing.save();
                logger.info('Existing user elevated to superadmin from environment');
            }
        }
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
