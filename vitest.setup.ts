import "@testing-library/jest-dom/vitest";

// jsdom implements localStorage/sessionStorage, but each test file should
// start from a clean slate since the storage adapter is a real singleton.
afterEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});
