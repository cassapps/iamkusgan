#!/usr/bin/env node

// Simple script to set Vercel environment variables via the Vercel API.
// Usage:
//   VERCEL_TOKEN=xxx node scripts/vercel-set-env.js --project <projectId> --key NAME --value VALUE --target production
// target: production | preview | development

import fetch from 'node-fetch';
import process from 'process';
import { program } from 'commander';

program
  .requiredOption('--project <project>', 'Vercel project ID')
  .requiredOption('--key <key>', 'Environment variable key')
  .requiredOption('--value <value>', 'Environment variable value')
  .option('--target <target>', 'Target environment (production|preview|development)', 'production')
  .option('--team <teamId>', 'Vercel Team ID (optional)');

program.parse(process.argv);
const opts = program.opts();

const token = process.env.VERCEL_TOKEN;
if (!token) {
  console.error('Please set VERCEL_TOKEN environment variable (see https://vercel.com/account/tokens)');
  process.exit(1);
}

async function upsertEnv() {
  const url = new URL(`https://api.vercel.com/v9/projects/${opts.project}/env`);
  if (opts.team) url.searchParams.set('teamId', opts.team);

  // Vercel uses POST to create envs and PUT to update; but for simplicity we'll first try to POST
  const payload = {
    key: opts.key,
    value: opts.value,
    target: [opts.target]
  };

  try {
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const body = await res.json();
    if (!res.ok) {
      console.error('Failed to create env:', body);
      // If it already exists, attempt to update (find matching env id)
      if (body.error && body.error.code === 'env_already_exists') {
        // fetch existing envs and update matching key
        const listUrl = new URL(`https://api.vercel.com/v9/projects/${opts.project}/env`);
        if (opts.team) listUrl.searchParams.set('teamId', opts.team);
        const listRes = await fetch(listUrl.toString(), { headers: { Authorization: `Bearer ${token}` } });
        const listBody = await listRes.json();
        const existing = (listBody.envs || []).find(e => e.key === opts.key && e.target.includes(opts.target));
        if (existing) {
          const putUrl = new URL(`https://api.vercel.com/v9/projects/${opts.project}/env/${existing.id}`);
          if (opts.team) putUrl.searchParams.set('teamId', opts.team);
          const updateRes = await fetch(putUrl.toString(), {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: opts.value })
          });
          const updateBody = await updateRes.json();
          if (updateRes.ok) {
            console.log('Updated env var', opts.key, 'for target', opts.target);
          } else {
            console.error('Failed to update env var:', updateBody);
            process.exit(1);
          }
        } else {
          console.error('Env exists but cannot find matching target to update');
          process.exit(1);
        }
      } else {
        process.exit(1);
      }
    } else {
      console.log('Created env var', opts.key, 'for target', opts.target);
    }
  } catch (e) {
    console.error('Error while setting env var', e && e.message);
    process.exit(1);
  }
}

upsertEnv();
