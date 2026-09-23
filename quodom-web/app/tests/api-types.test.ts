import { describe, expect, it } from 'vitest';
import openapiTS, { astToString } from 'openapi-typescript';
import committed from '../src/api/schema.d.ts?raw';
import spec from '../../api/openapi.yaml?raw';

// schema.d.ts is generated from api/openapi.yaml and committed. If someone
// edits the contract and forgets `npm run api-types`, the app keeps compiling
// against the old shapes and nothing complains, which is what this catches.
describe('generated API types', () => {
  it('match api/openapi.yaml', async () => {
    const fresh = astToString(await openapiTS(spec));
    const norm = (s: string) => s.replace(/\r\n/g, '\n').trim();
    // The CLI adds a header comment the programmatic API doesn't; the rest must match.
    expect(norm(committed)).toContain(norm(fresh));
  });
});
