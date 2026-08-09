import { beforeEach, describe, expect, it } from "vitest";
import { getStorage } from "@/lib/db/storage";

// jsdom provides a real window.localStorage, so this exercises the same
// LocalStorageAdapter code path the browser uses — including namespacing
// and persistence across "reads" that simulate a page reload.
describe("LocalStorageAdapter", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns null for a key that was never set", async () => {
    const storage = getStorage();
    expect(await storage.get("profile")).toBeNull();
  });

  it("round-trips a value through set/get", async () => {
    const storage = getStorage();
    await storage.set("profile", { name: "Asha", age: 24 });
    expect(await storage.get("profile")).toEqual({ name: "Asha", age: 24 });
  });

  it("survives a simulated page reload (data outlives the adapter instance)", async () => {
    await getStorage().set("streak", { current: 3, longest: 5, lastPracticeDate: "2026-01-10" });

    // Nothing in the adapter is held in memory — a fresh call to getStorage()
    // (as would happen on the next page load) must see the same data purely
    // from what's in window.localStorage.
    const reloaded = getStorage();
    expect(await reloaded.get("streak")).toEqual({
      current: 3,
      longest: 5,
      lastPracticeDate: "2026-01-10",
    });
  });

  it("namespaces keys so they don't collide with other apps on the same origin", async () => {
    await getStorage().set("profile", { name: "Asha" });
    const rawKeys = Object.keys(window.localStorage);
    expect(rawKeys.some((k) => k.startsWith("speech-therapy:v1:"))).toBe(true);
  });

  it("removes a value", async () => {
    const storage = getStorage();
    await storage.set("profile", { name: "Asha" });
    await storage.remove("profile");
    expect(await storage.get("profile")).toBeNull();
  });

  it("lists keys under a prefix without the namespace", async () => {
    const storage = getStorage();
    await storage.set("session:1", { id: 1 });
    await storage.set("session:2", { id: 2 });
    await storage.set("profile", { name: "Asha" });

    const keys = await storage.keys("session:");
    expect(keys.sort()).toEqual(["session:1", "session:2"]);
  });

  it("treats corrupt JSON as absent instead of throwing", async () => {
    window.localStorage.setItem("speech-therapy:v1:profile", "{not valid json");
    const storage = getStorage();
    await expect(storage.get("profile")).resolves.toBeNull();
  });
});
