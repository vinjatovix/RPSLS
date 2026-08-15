export class BuffManager {
  constructor(gameTimeProvider) {
    this.gameTimeProvider = gameTimeProvider;
    this.buffs = {};
  }

  applyBuff(type, duration, amount) {
    this.buffs[type] = { until: this.gameTimeProvider() + duration, amount };
  }

  isBuffActive(type) {
    const buff = this.buffs[type];
    if (!buff) return false;
    if (this.gameTimeProvider() > buff.until) {
      delete this.buffs[type];
      return false;
    }
    return true;
  }

  getMultiplier(type) {
    if (["haste", "turn", "damage", "speed", "slow", "freeze"].includes(type)) {
      return this.isBuffActive(type) ? this.buffs[type].amount : 1;
    }

    if (["armor", "vampire", "regeneration"].includes(type)) {
      return this.isBuffActive(type) ? this.buffs[type].amount : null;
    }

    return 1;
  }

  getSpeedMultiplier() {
    let multiplier = 1;
    if (this.isBuffActive("speed")) multiplier *= this.buffs.speed.amount;
    if (this.isBuffActive("slow")) multiplier *= this.buffs.slow.amount;
    if (this.isBuffActive("freeze")) multiplier *= this.buffs.freeze.amount;
    
    return multiplier;
  }

  isConfused() {
    return this.isBuffActive("confusion");
  }
}
