/**
 * Test setup — lets env-gated modules (anything importing src/lib/env.ts) be imported
 * without real secrets. Tests are pure-function only and never hit the network.
 */
process.env.GEMINI_API_KEY ||= "test-gemini-key";
