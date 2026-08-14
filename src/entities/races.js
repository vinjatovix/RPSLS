/**
 * Razas - Subclases de Enemy
 * Cada una fija su equipo (las stats se leen de RACE_STATS en config)
 */

import { Enemy } from "./Enemy.js";

export class Rock extends Enemy {
  static teamName = "rocks";
  constructor(props) {
    super(props, Rock.teamName);
  }
}

export class Paper extends Enemy {
  static teamName = "papers";
  constructor(props) {
    super(props, Paper.teamName);
  }
}

export class Scissors extends Enemy {
  static teamName = "scissors";
  constructor(props) {
    super(props, Scissors.teamName);
  }

  drawEmoji() {
    this.ctx.save();
    this.ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
    this.ctx.rotate(this.angle - Math.PI / 2);
    this.ctx.translate(-(this.x + this.width / 2), -(this.y + this.height / 2));
    this.ctx.fillText(this.emoji, this.x - 2, this.y + 16);
    this.ctx.restore();
  }
}

export class Lizard extends Enemy {
  static teamName = "lizards";
  constructor(props) {
    super(props, Lizard.teamName);
  }

  drawEmoji() {
    this.ctx.save();
    this.ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
    this.ctx.rotate(this.angle + Math.PI / 1.5);
    this.ctx.translate(-(this.x + this.width / 2), -(this.y + this.height / 2));
    this.ctx.fillText(this.emoji, this.x - 2, this.y + 16);
    this.ctx.restore();
  }
}

export class Spock extends Enemy {
  static teamName = "spocks";
  constructor(props) {
    super(props, Spock.teamName);
  }
}

/**
 * Registro de clases de raza por nombre de equipo
 */
export const RACE_CLASSES = {
  rocks: Rock,
  papers: Paper,
  scissors: Scissors,
  lizards: Lizard,
  spocks: Spock
};

/**
 * Lista de todas las clases de raza (para spawnear una de cada)
 */
export const ALL_RACES = [Rock, Paper, Scissors, Lizard, Spock];
