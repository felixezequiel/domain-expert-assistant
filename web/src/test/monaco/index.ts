// Test stubs for Monaco, which can't load in jsdom. Aliased in via vite.config `test.alias`
// for both `monaco-editor` (the `editor` namespace our code touches at module load) and the
// `?worker` bundle (a no-op Worker constructor). One index.ts serves both specifiers.
// The real diff editor is verified via the production build + a browser check, not jsdom.
export const editor = {
  defineTheme: (): void => undefined,
};

export default class MonacoWorkerStub {}
