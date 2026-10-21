import { app } from './app.js';
import { config } from './config.js';

const server = app.listen(config.PORT, () => {
  console.log(`CivicGuard API server listening on port ${config.PORT} [${config.NODE_ENV}]`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Process terminated.');
    process.exit(0);
  });
});
