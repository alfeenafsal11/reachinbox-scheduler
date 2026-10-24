import net from 'net';
import path from 'path';
import { spawn, execSync } from 'child_process';
import fs from 'fs';

async function checkPort(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(800);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function startRedis() {
  const isRunning = await checkPort(6379);
  if (isRunning) {
    console.log('✅ Redis is already running on port 6379');
    return;
  }

  const redisExe = path.resolve(__dirname, '../tools/redis/redis-server.exe');
  if (!fs.existsSync(redisExe)) {
    console.log('⚠️ Local redis binary not found at', redisExe);
    return;
  }

  console.log('🚀 Starting local Redis server on port 6379...');
  const proc = spawn(redisExe, [], {
    detached: true,
    stdio: 'ignore',
  });
  proc.unref();

  // Wait for Redis to be up
  for (let i = 0; i < 20; i++) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 300));
    // eslint-disable-next-line no-await-in-loop
    if (await checkPort(6379)) {
      console.log('✅ Local Redis is ready on port 6379!');
      return;
    }
  }
}

async function startPostgres() {
  const isRunning = await checkPort(5432);
  if (isRunning) {
    console.log('✅ PostgreSQL is already running on port 5432');
    return;
  }

  const nativeBin = path.resolve(
    __dirname,
    '../backend/node_modules/@embedded-postgres/windows-x64/native/bin'
  );
  const pgCtl = path.join(nativeBin, 'pg_ctl.exe');
  const initDb = path.join(nativeBin, 'initdb.exe');
  const dbDir = path.resolve(__dirname, '../pgdata');
  const logFile = path.resolve(__dirname, '../pgdata.log');

  if (!fs.existsSync(dbDir)) {
    console.log('📦 Initializing PostgreSQL cluster at', dbDir);
    fs.mkdirSync(dbDir, { recursive: true });
    execSync(`"${initDb}" -D "${dbDir}" -U postgres -A trust -E UTF8`, {
      stdio: 'inherit',
    });
  }

  console.log('🚀 Starting local PostgreSQL server on port 5432...');
  execSync(`"${pgCtl}" -D "${dbDir}" -l "${logFile}" start`, {
    stdio: 'inherit',
  });

  // Wait for Postgres to be up
  for (let i = 0; i < 25; i++) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 400));
    // eslint-disable-next-line no-await-in-loop
    if (await checkPort(5432)) {
      console.log('✅ Local PostgreSQL is ready on port 5432!');
      // Ensure 'scheduler' database exists
      try {
        const createdb = path.join(nativeBin, 'createdb.exe');
        execSync(`"${createdb}" -h 127.0.0.1 -p 5432 -U postgres scheduler`, {
          stdio: 'ignore',
        });
        console.log('✅ Created database "scheduler"');
      } catch {
        // already exists
      }
      return;
    }
  }
}

async function main() {
  await startRedis();
  await startPostgres();
  console.log('🎉 Local infra is fully active and ready!');
}

main().catch((err) => {
  console.error('Failed to start local infra:', err);
  process.exit(1);
});
