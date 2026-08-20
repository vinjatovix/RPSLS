export class ParticlePool {
  constructor(size = 1000) {
    this.maxSize = size;
    this.pools = new Map();
    this.totalAllocated = new Map();
    this.createdCounts = new Map();
    this.preallocatedOptions = new Map();
  }

  preAllocate(type, count, options = {}) {
    let subpool = this.pools.get(type);
    if (!subpool) {
      subpool = [];
      this.pools.set(type, subpool);
    }

    this.totalAllocated.set(type, count);
    this.createdCounts.set(type, count);
    this.preallocatedOptions.set(type, options);

    for (let i = 0; i < count; i++) {
      const p = new type(options);
      p.dead = true;
      p._inPool = true;
      subpool.push(p);
    }
  }

  acquire(type, x, y, options = {}) {
    let subpool = this.pools.get(type);
    if (!subpool) {
      subpool = [];
      this.pools.set(type, subpool);
    }

    const preallocOpts = this.preallocatedOptions.get(type) || {};
    const mergedOptions = { ...preallocOpts, x, y, ...options };

    let particle;
    if (subpool.length > 0) {
      particle = subpool.pop();
      particle._inPool = false;
      particle.init(mergedOptions);
    } else {
      const maxAllowed = this.totalAllocated.get(type);
      const currentCreated = this.createdCounts.get(type) || 0;

      if (maxAllowed !== undefined && currentCreated >= maxAllowed) {

        return null;
      }

      particle = new type(mergedOptions);
      particle._inPool = false;
      this.createdCounts.set(type, currentCreated + 1);
    }

    return particle;
  }

  release(particle) {
    if (!particle || particle._inPool) {

      return;
    }

    const type = particle.constructor;
    let subpool = this.pools.get(type);
    if (!subpool) {
      subpool = [];
      this.pools.set(type, subpool);
    }

    if (subpool.length < this.maxSize) {
      particle._inPool = true;
      subpool.push(particle);
    } else {
      const currentCreated = this.createdCounts.get(type) || 0;
      if (currentCreated > 0) {
        this.createdCounts.set(type, currentCreated - 1);
      }
    }
  }
}
