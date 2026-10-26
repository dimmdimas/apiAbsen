import express from 'express';
import cors from 'cors';
import os from 'os'; // Tambahkan import os
import connectDB from './utils/db.js';
import router from './routes/routes_user.js';
import routerData from './routes/routes_day.js';
import exportRouter from './routes/exportRouter.js';
import monitoringRouter from './routes/monitoringRouter.js';
import dataUsersRouter from './routes/dataUsersRouter.js';

// Fungsi untuk mendapatkan IP lokal (LAN)
function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Ambil IPv4 dan abaikan IP internal (127.0.0.1)
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1'; // Fallback jika tidak ada jaringan
}

async function server() {
  const app = express();
  const PORT = 3000;

  const db = await connectDB();
  app.use(express.json());
  app.use(cors());

  app.use('/api/users', router);
  app.use('/api/', routerData);
  app.use('/api', exportRouter);
  app.use('/api', monitoringRouter);
  app.use('/api', dataUsersRouter);

  app.use(express.json({ limit: '10mb' }));

  // Gunakan '0.0.0.0' agar bisa diakses dari IP mana saja (termasuk Cloudflare)
  app.listen(PORT, '0.0.0.0', () => {
    const currentIP = getLocalIP();
    console.log(`⚡️ Server berjalan di http://${currentIP}:${PORT}`);
    console.log(db);
  });
}

server();