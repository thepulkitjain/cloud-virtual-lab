import { createApp } from './app';
import envConfig from './config/env.config';
import { prisma } from './config/database';

const PORT = envConfig.port;
const app = createApp();

const server = app.listen(PORT, () => {
  console.log(`🚀 Virtual Lab & Secure Storage API running on http://localhost:${PORT}`);
  console.log(`📡 Environment: ${envConfig.nodeEnv}`);
  console.log(`🌐 Allowed Client URL: ${envConfig.clientUrl}`);
  console.log(`📡 Health check accessible at: http://localhost:${PORT}/api/health`);
});

// Graceful shutdown handling
const handleShutdown = async (signal: string) => {
  console.log(`\n🛑 Received ${signal}. Initiating graceful shutdown...`);
  server.close(async () => {
    try {
      await prisma.$disconnect();
      console.log('✅ PostgreSQL database connection closed cleanly.');
      process.exit(0);
    } catch (err) {
      console.error('❌ Error during database disconnect:', err);
      process.exit(1);
    }
  });

  // Force close after 10 seconds if hanging
  setTimeout(() => {
    console.error('⚠️  Forced shutdown: Connections did not close in time.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

export default server;
