#!/usr/bin/env node
/*
 * Helper script to start the Expo dev server with a network-accessible
 * backend URL so physical devices can connect without additional setup.
 */
const { networkInterfaces } = require('os');
const { spawn } = require('child_process');

const DEFAULT_API_PORT = process.env.GUARDIAN_API_PORT ?? '2699';
const CLI = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function isPrivateAddress(address) {
  if (!address) return false;
  if (address.startsWith('10.')) return true;
  if (address.startsWith('192.168.')) return true;
  if (address.startsWith('172.')) {
    const secondOctet = Number(address.split('.')[1]);
    return secondOctet >= 16 && secondOctet <= 31;
  }
  if (address.startsWith('169.254.')) return true;
  return false;
}

function getLocalAddress() {
  if (process.env.GUARDIAN_API_HOST) {
    return process.env.GUARDIAN_API_HOST;
  }

  const nets = networkInterfaces();
  const candidates = [];

  for (const entries of Object.values(nets)) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        candidates.push(entry.address);
      }
    }
  }

  if (candidates.length === 0) {
    return '127.0.0.1';
  }

  const preferred = candidates.find((address) => isPrivateAddress(address));
  return preferred ?? candidates[0];
}

function buildApiUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  const host = getLocalAddress();
  return `http://${host}:${DEFAULT_API_PORT}`;
}

function run() {
  const apiUrl = buildApiUrl();
  const expoArgs = ['expo', 'start', '-c', ...process.argv.slice(2)];

  console.log(`\nUsing backend API: ${apiUrl}`);
  console.log('You can override this via EXPO_PUBLIC_API_URL or GUARDIAN_API_HOST.\n');

  const child = spawn(CLI, expoArgs, {
    stdio: 'inherit',
    env: { ...process.env, EXPO_PUBLIC_API_URL: apiUrl },
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}

run();
