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
    this.context.save();
    this.context.translate(this.x + this.width / 2, this.y + this.height / 2);
    this.context.rotate(this.angle - Math.PI / 2);
    this.context.translate(-(this.x + this.width / 2), -(this.y + this.height / 2));
    this.context.fillText(this.emoji, this.x - 2, this.y + 16);
    this.context.restore();
  }
}

export class Lizard extends Enemy {
  static teamName = "lizards";
  constructor(props) {
    super(props, Lizard.teamName);
  }

  drawEmoji() {
    this.context.save();
    this.context.translate(this.x + this.width / 2, this.y + this.height / 2);
    this.context.rotate(this.angle + Math.PI / 1.5);
    this.context.translate(-(this.x + this.width / 2), -(this.y + this.height / 2));
    this.context.fillText(this.emoji, this.x - 2, this.y + 16);
    this.context.restore();
  }
}

export class Spock extends Enemy {
  static teamName = "spocks";
  constructor(props) {
    super(props, Spock.teamName);
  }
}

export const RACE_CLASSES = {
  rocks: Rock,
  papers: Paper,
  scissors: Scissors,
  lizards: Lizard,
  spocks: Spock
};

export const ALL_RACES = [Rock, Paper, Scissors, Lizard, Spock];
