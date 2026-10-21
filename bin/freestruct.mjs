#!/usr/bin/env node
// Thin CLI entry (prestruct's bin/cli.mjs pattern): the engine lives in
// engine/, this shim only forwards. Kept separate so the packaged runtime
// surface (exports) never has to depend on where the CLI wires up.
import { runInject } from '../engine/inject.js';

runInject();
