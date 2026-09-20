#!/usr/bin/env node

/* Node */
import { existsSync, readFileSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';

/* MCP */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const packageMetadata = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const qualifiedName = process.env.SMITHERY_SERVER_NAME ?? 'openfate-ai/bazi-mcp';
const bundlePath = new URL(`../release/openfate-bazi-mcp-v${packageMetadata.version}.mcpb`, import.meta.url);
const iconPath = new URL('../mcpb/assets/icon.png', import.meta.url);
const serverApiUrl = `https://api.smithery.ai/servers/${encodeURIComponent(qualifiedName)}`;
const smitheryMetadata = {
  displayName: 'OpenFate Bazi MCP',
  description: 'Deterministic Bazi and Four Pillars charts with True Solar Time, Da Yun cycles, enriched pillars, and branch interactions.',
  homepage: 'https://openfate.ai/developers/bazi-mcp',
  repositoryUrl: 'https://github.com/openfate-ai/openfate-mcp',
  backlinkUrl: 'https://openfate.ai',
  license: packageMetadata.license,
  unlisted: false,
};

/** Resolve the Smithery CLI settings path for the current operating system. */
function getSmitherySettingsPath() {
  if (process.env.SMITHERY_CONFIG_PATH) return process.env.SMITHERY_CONFIG_PATH;

  if (platform() === 'darwin') return join(homedir(), 'Library', 'Application Support', 'smithery', 'settings.json');
  if (platform() === 'win32') {
    return join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'smithery', 'settings.json');
  }
  return join(homedir(), '.config', 'smithery', 'settings.json');
}

/** Load the Smithery API key without exposing it in logs. */
function getSmitheryApiKey() {
  if (process.env.SMITHERY_API_KEY) return process.env.SMITHERY_API_KEY;

  const settingsPath = getSmitherySettingsPath();
  if (!existsSync(settingsPath)) {
    throw new Error('SMITHERY_API_KEY is not set and Smithery settings were not found. Run `npx --yes smithery@latest auth login` first.');
  }

  const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
  if (!settings.apiKey) {
    throw new Error('Smithery settings do not contain an API key. Run `npx --yes smithery@latest auth login` first.');
  }
  return settings.apiKey;
}

/** Read the server's real MCP tool registry before publishing its bundle. */
async function listTools() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/stdio.js'],
  });
  const client = new Client({ name: 'openfate-smithery-publisher', version: packageMetadata.version });

  await client.connect(transport);
  const result = await client.listTools();
  await client.close();

  return result.tools;
}

/** Parse an authenticated Smithery response and surface its full API error. */
async function readSmitheryResponse(response, action) {
  const responseText = await response.text();
  let parsedResponse;
  try {
    parsedResponse = JSON.parse(responseText);
  } catch {
    throw new Error(`${action} returned non-JSON (${response.status}): ${responseText}`);
  }

  if (!response.ok) throw new Error(`${action} failed with ${response.status}: ${responseText}`);
  return parsedResponse;
}

/** Wait until Smithery has scanned and accepted the submitted MCPB release. */
async function waitForDeployment(apiKey, deploymentId) {
  const terminalFailures = new Set(['FAILURE', 'FAILURE_SCAN', 'AUTH_REQUIRED', 'AUTH_TIMEOUT', 'CANCELLED', 'INTERNAL_ERROR']);

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const response = await fetch(`${serverApiUrl}/releases/${encodeURIComponent(deploymentId)}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${apiKey}` },
    });
    const release = await readSmitheryResponse(response, 'Smithery release status check');
    const status = String(release.status).toUpperCase();
    if (status === 'SUCCESS') return release;
    if (terminalFailures.has(status)) {
      throw new Error(`Smithery release ${deploymentId} ended with ${status}: ${JSON.stringify(release.logs ?? [])}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error(`Smithery release ${deploymentId} did not finish within 120 seconds.`);
}

/** Keep the Smithery directory card synchronized with the published package. */
async function updateSmitheryMetadata(apiKey) {
  const response = await fetch(serverApiUrl, {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(smitheryMetadata),
  });
  return readSmitheryResponse(response, 'Smithery metadata update');
}

/** Upload the branded MCP icon used by Smithery's public directory. */
async function uploadSmitheryIcon(apiKey) {
  const form = new FormData();
  form.append('icon', new Blob([readFileSync(iconPath)], { type: 'image/png' }), 'openfate-bazi-mcp.png');
  const response = await fetch(`${serverApiUrl}/icon`, {
    method: 'PUT',
    headers: { Accept: 'application/json', Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  return readSmitheryResponse(response, 'Smithery icon upload');
}

if (!existsSync(bundlePath)) {
  throw new Error(`MCPB bundle not found at ${bundlePath.pathname}. Run \`npm run mcpb:pack\` first.`);
}

const tools = await listTools();
const payload = {
  type: 'stdio',
  runtime: 'node',
  serverCard: {
    serverInfo: {
      name: 'openfate-bazi-mcp',
      version: packageMetadata.version,
    },
    tools: tools.map((tool) => ({
      name: tool.name,
      description: tool.description ?? '',
      inputSchema: tool.inputSchema ?? { type: 'object', properties: {} },
    })),
  },
};

const apiKey = getSmitheryApiKey();
const form = new FormData();
form.append('payload', JSON.stringify(payload));
form.append(
  'bundle',
  new Blob([readFileSync(bundlePath)], { type: 'application/octet-stream' }),
  `openfate-bazi-mcp-v${packageMetadata.version}.mcpb`,
);

const response = await fetch(`https://api.smithery.ai/servers/${encodeURIComponent(qualifiedName)}/releases`, {
  method: 'PUT',
  headers: {
    Accept: 'application/json',
    Authorization: `Bearer ${apiKey}`,
  },
  body: form,
});
const parsedResponse = await readSmitheryResponse(response, 'Smithery publish');
const release = await waitForDeployment(apiKey, parsedResponse.deploymentId);
await updateSmitheryMetadata(apiKey);
const icon = await uploadSmitheryIcon(apiKey);

console.log(JSON.stringify({
  qualifiedName,
  version: packageMetadata.version,
  deploymentId: parsedResponse.deploymentId,
  status: release.status,
  mcpUrl: release.mcpUrl ?? parsedResponse.mcpUrl,
  iconUrl: icon.iconUrl,
}, null, 2));
