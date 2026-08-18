import { CollisionDetector } from "../canvas/index.js";

export class CombatSystem {
  constructor({ entity, baseDamage, damageMultiplier, armor, vampire, buffManager, scoreManager }) {
    this.entity = entity;
    this.baseDamage = baseDamage;
    this.damageMultiplier = damageMultiplier;
    this.armor = armor;
    this.vampire = vampire;
    this.buffManager = buffManager;
    this.scoreManager = scoreManager;
  }

  getDamage() {
    const buffMultiplier = this.buffManager.getMultiplier("damage");
    return this.baseDamage * this.damageMultiplier * buffMultiplier;
  }

  getIncomingDamageMultiplier() {
    const armorBuff = this.buffManager.getMultiplier("armor");
    if (armorBuff !== null) return armorBuff;
    
    return Math.max(0, 1 - this.armor);
  }

  kill(enemy) {
    if (this.entity.dead || enemy.dead) return;
    if (!this.entity.aim.includes(enemy.team)) return;

    const damage = this.getDamage() * enemy.combatSystem.getIncomingDamageMultiplier();
    enemy.life -= damage;

    const vampireBuff = this.buffManager.getMultiplier("vampire");
    const healRatio = vampireBuff !== null ? vampireBuff : this.vampire;
    if (healRatio > 0 && damage > 0) {
      this.entity.life = Math.min(this.entity.maxLife, this.entity.life + damage * healRatio);
    }

    if (enemy.life <= 0) {
      enemy.dead = true;
      enemy.killedBy = this.entity.team;
      this.scoreManager.recordKill(this.entity.team, enemy.team);
    }
  }

  checkCollision(allEnemies) {
    if (this.entity.dead) return;

    let candidates = allEnemies;
    const grid = this.entity.game?.spatialGrid;
    if (grid) {
      const maxDim = Math.max(this.entity.width || 20, this.entity.height || 20);
      const queryRadius = maxDim * 1.25; // Margen de seguridad dinámico del 25%
      const cx = this.entity.x + (this.entity.width || 20) / 2;
      const cy = this.entity.y + (this.entity.height || 20) / 2;
      candidates = grid.query(cx, cy, queryRadius);
    }

    for (const enemy of candidates) {
      if (enemy !== this.entity && !enemy.dead && CollisionDetector.checkOverlap(this.entity, enemy)) {
        this.kill(enemy);
      }
    }
  }
}
