const ANGLE_THRESHOLD_ACCELERATE = Math.PI / 12;  // ~15° - aligned enough to accelerate
const ANGLE_THRESHOLD_BRAKE = Math.PI / 8;        // ~22.5° - turning too sharp, brake
const BASE_FRAME_RATE = 30;                       // reference frame rate for deltaTime normalization

export class MovementController {
  constructor({ entity, stats, buffManager, canvasAdapter, options }) {
    this.entity = entity;
    this.buffManager = buffManager;
    this.canvasAdapter = canvasAdapter;
    this.options = options;

    const scale = canvasAdapter.getScale();
    const movement = stats.movement;
    const { speed = 1, acceleration = 1, turn = 1, deceleration = 1 } = entity.modifiers || {};

    this.speed = (movement.baseSpeed + Math.random() * movement.speedVariance) * speed * scale;
    this.maxSpeed = movement.maxSpeed * speed * (scale * 1.5);
    this.minSpeed = movement.minSpeed;
    this.acceleration = movement.acceleration * acceleration * scale * 2;
    this.deceleration = movement.deceleration * acceleration * deceleration * scale;
    this.rotationSpeed = movement.rotationSpeed * turn * (1 + scale);
    this.rotationAcceleration = movement.rotationAcceleration * turn * (1 + scale);

    this.velocityX = 0;
    this.velocityY = 0;
    this.angularSpeed = 0;
  }

  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  limitSpeed() {
    const speedMultiplier = this.buffManager.getSpeedMultiplier();
    this.speed = this.clamp(this.speed, this.minSpeed * speedMultiplier, this.maxSpeed * speedMultiplier);
  }

  calculateAngleDiff() {
    const angleDiff = this.entity.angle - Math.atan2(this.entity.aimY - this.entity.y, this.entity.aimX - this.entity.x);
    if (angleDiff > Math.PI) {
      return angleDiff - 2 * Math.PI;
    }
    if (angleDiff < -Math.PI) {
      return angleDiff + 2 * Math.PI;
    }
    return angleDiff;
  }

  calculateRotationSpeed(angleDiff) {
    const turnMultiplier = this.buffManager.getMultiplier("turn");
    const angularSpeedLimit = this.rotationSpeed * turnMultiplier;
    const angularAcceleration = this.rotationAcceleration * turnMultiplier;
    this.angularSpeed += (angleDiff < 0 ? 1 : -1) * angularAcceleration;
    this.angularSpeed = this.clamp(this.angularSpeed, -angularSpeedLimit, angularSpeedLimit);
    this.entity.angle += this.angularSpeed;
  }

  calculateSpeed(angleDiff) {
    const speedMultiplier = this.buffManager.getSpeedMultiplier();
    const accelerationMultiplier = this.buffManager.getMultiplier("haste");
    
    if (Math.abs(angleDiff) < ANGLE_THRESHOLD_ACCELERATE) {
      this.speed += this.acceleration * speedMultiplier * accelerationMultiplier;
    }
    if (Math.abs(angleDiff) > ANGLE_THRESHOLD_BRAKE) {
      this.speed -= this.deceleration * speedMultiplier * accelerationMultiplier;
    }

    this.limitSpeed();
  }

  limitPosition() {
    const clamped = this.canvasAdapter.clampPosition(this.entity);
    this.entity.x = clamped.x;
    this.entity.y = clamped.y;
  }

  move(deltaTime) {
    const frameFactor = deltaTime / BASE_FRAME_RATE;
    const angleDiff = this.calculateAngleDiff();
    this.calculateRotationSpeed(angleDiff);
    this.calculateSpeed(angleDiff);
    this.velocityX = Math.cos(this.entity.angle) * this.speed;
    this.velocityY = Math.sin(this.entity.angle) * this.speed;
    this.entity.x += this.velocityX * frameFactor;
    this.entity.y += this.velocityY * frameFactor;

    if (this.options.mechanics.limitCanvas) {
      this.limitPosition();
    }
  }
}
