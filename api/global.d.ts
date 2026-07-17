// Vercel's Node runtime provides `process` at runtime; this repo's api/ files
// were never actually type-checked before (no tsconfig covered this folder —
// see api/tsconfig.json), so `process.env.X` was effectively `any` everywhere
// it's used. Declaring it loosely here matches that existing behavior instead
// of pulling in full @types/node, which surfaces unrelated pre-existing
// strictness gaps in this file that are a separate job, not tonight's fix.
declare const process: any;
