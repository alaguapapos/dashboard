// Each provider owns its own short-lived memory cache. Nothing is persisted to disk.
export class NavigationSnapshots {
  private entries = new Map<string, {value: unknown; savedAt: number}>();
  private now: () => number;
  private maxAge: number;
  constructor(now = () => Date.now(), maxAge = 300_000) { this.now = now; this.maxAge = maxAge; }
  get<T>(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (this.now() - entry.savedAt >= this.maxAge) { this.entries.delete(key); return undefined; }
    return entry.value as T;
  }
  set<T>(key: string, value: T) {
    this.entries.delete(key);
    this.entries.set(key, {value, savedAt: this.now()});
    if (this.entries.size > 20) this.entries.delete(this.entries.keys().next().value!);
  }
  delete(key: string) { this.entries.delete(key); }
  clear() { this.entries.clear(); }
}
