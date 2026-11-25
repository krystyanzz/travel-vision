// Controle de cota e cache por fornecedor. Implementação em memória para o MVP;
// a interface é a mesma que a versão com Redis usará (contagem, fila, prioridade).

export class QuotaExceededError extends Error {
  constructor(public readonly providerId: string, public readonly retryAfterMs: number) {
    super(`Cota do fornecedor ${providerId} esgotada; tente em ${Math.ceil(retryAfterMs / 1000)} s`);
  }
}

export class SlidingWindowQuota {
  private hits: number[] = [];

  constructor(
    public readonly providerId: string,
    private readonly limit: number,
    private readonly windowMs = 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  /** Consome uma unidade da cota ou lança QuotaExceededError (nunca contorna o limite). */
  take(): void {
    const t = this.now();
    this.hits = this.hits.filter((h) => t - h < this.windowMs);
    if (this.hits.length >= this.limit) {
      throw new QuotaExceededError(this.providerId, this.windowMs - (t - this.hits[0]));
    }
    this.hits.push(t);
  }

  remaining(): number {
    const t = this.now();
    return this.limit - this.hits.filter((h) => t - h < this.windowMs).length;
  }
}

export class TtlCache<V> {
  private store = new Map<string, { value: V; expires: number }>();

  constructor(private readonly ttlMs: number, private readonly now: () => number = Date.now) {}

  get(key: string): V | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expires <= this.now()) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: V): void {
    this.store.set(key, { value, expires: this.now() + this.ttlMs });
  }

  async getOrLoad(key: string, load: () => Promise<V>): Promise<V> {
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    const value = await load();
    this.set(key, value);
    return value;
  }
}
