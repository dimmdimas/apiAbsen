import express from 'express'
import cors from 'cors'
import connectDB from './utils/db.js';
import router from './routes/routes_user.js';
import routerData from './routes/routes_day.js';
import exportRouter from './routes/exportRouter.js';
import monitoringRouter from './routes/monitoringRouter.js'
import dataUsersRouter from './routes/dataUsersRouter.js'

async function server() {
  const app = express();
  const PORT = 3000;

  const db = await connectDB()
  app.use(express.json());
  app.use(cors());

  app.use('/api/users', router);
  app.use('/api/', routerData)
  app.use('/api', exportRouter);
  app.use('/api', monitoringRouter);
  app.use('/api', dataUsersRouter);

  app.use(express.json({ limit: '10mb' }));


  app.listen(PORT, () => {
    console.log(`⚡️ Server berjalan di http://localhost:${PORT}`);
    console.log(db);
  });
}

server();