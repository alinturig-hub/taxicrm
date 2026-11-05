/** Isolated client-component preview: no app routes, authentication, database or provider imports. */
import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const root = process.cwd(),
  output = process.env.FLOW_PREVIEW_OUTPUT || "/tmp/taxicrm-flow-preview";
await mkdir(output, { recursive: true });
const contents = `import React from 'react';
import {createRoot} from 'react-dom/client';
import FlowBuilder from './src/components/marketing/flows/FlowBuilder';
import FlowLibrary from './src/components/marketing/flows/FlowLibrary';
import './src/app/workspace-theme.css';
const params=new URLSearchParams(location.search);
createRoot(document.getElementById('root')).render(<div data-workspace data-theme={params.get('theme')||'dark'} style={{padding:24,minHeight:'100vh'}}>{params.has('library') ? <FlowLibrary storageScope="synthetic-library-review" canEdit={!params.has('readonly')}/> : <FlowBuilder storageScope="synthetic-browser-review" canEdit={!params.has('readonly')}/>}</div>);`;
await build({
  stdin: { contents, loader: "tsx", resolveDir: root },
  outfile: resolve(output, "app.js"),
  bundle: true,
  platform: "browser",
  format: "iife",
  jsx: "automatic",
  tsconfig: resolve(root, "tsconfig.json"),
  nodePaths: [resolve(root, "node_modules")],
  loader: { ".css": "css" },
  define: { "process.env.NODE_ENV": '"development"' },
  logLevel: "warning",
});
await writeFile(
  resolve(output, "index.html"),
  '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TaxiCRM flow preview — synthetic only</title><link rel="stylesheet" href="app.css"><style>body{margin:0;background:#141820;font-family:system-ui,sans-serif}*{box-sizing:border-box}</style></head><body><div id="root"></div><script src="app.js"></script></body></html>',
);
const files = {
  "/": ["index.html", "text/html"],
  "/app.js": ["app.js", "text/javascript"],
  "/app.css": ["app.css", "text/css"],
};
const server = createServer(async (req, res) => {
  const entry = files[new URL(req.url, "http://127.0.0.1").pathname];
  if (!["GET", "HEAD"].includes(req.method)) {
    res.writeHead(405);
    res.end();
    return;
  }
  if (!entry) {
    res.writeHead(404);
    res.end();
    return;
  }
  try {
    const body = await readFile(resolve(output, entry[0]));
    res.writeHead(200, {
      "Content-Type": entry[1],
      "Cache-Control": "no-store",
    });
    res.end(req.method === "HEAD" ? undefined : body);
  } catch {
    res.writeHead(500);
    res.end("Preview file unavailable.");
  }
});
server.listen(5533, "127.0.0.1", () =>
  console.log(
    "Synthetic flow preview: http://127.0.0.1:5533 (no application backend)",
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.close(() => process.exit(0)));
