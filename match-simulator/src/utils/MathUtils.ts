export class MathUtils {
  /**
   * Clamp a value between min and max
   */
  static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
  
  /**
   * Calculate distance between two points
   */
  static distance(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  /**
   * Generate random float between min and max
   */
  static randomFloat(min: number, max: number): number {
    return min + (max - min) * Math.random();
  }
  
  /**
   * Generate random integer between min and max (inclusive)
   */
  static randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  
  /**
   * Probability check (returns true if random value <= chance)
   */
  static probability(chance: number): boolean {
    return Math.random() <= chance;
  }
  
  /**
   * Normalize angle to 0-2π range
   */
  static normalizeAngle(angle: number): number {
    while (angle < 0) {
      angle += 2 * Math.PI;
    }
    while (angle >= 2 * Math.PI) {
      angle -= 2 * Math.PI;
    }
    return angle;
  }
  
  /**
   * Calculate angle between two points
   */
  static angleBetween(x1: number, y1: number, x2: number, y2: number): number {
    return Math.atan2(y2 - y1, x2 - x1);
  }
  
  /**
   * Linear interpolation between two values
   */
  static lerp(start: number, end: number, factor: number): number {
    return start + (end - start) * factor;
  }
  
  /**
   * Smooth step interpolation (smoother than linear)
   */
  static smoothStep(start: number, end: number, factor: number): number {
    const t = MathUtils.clamp(factor, 0, 1);
    const smoothT = t * t * (3 - 2 * t);
    return start + (end - start) * smoothT;
  }
  
  /**
   * Calculate weighted average
   */
  static weightedAverage(values: number[], weights: number[]): number {
    if (values.length !== weights.length) {
      throw new Error('Values and weights arrays must have the same length');
    }
    
    let sum = 0;
    let weightSum = 0;
    
    for (let i = 0; i < values.length; i++) {
      sum += values[i] * weights[i];
      weightSum += weights[i];
    }
    
    return weightSum > 0 ? sum / weightSum : 0;
  }
  
  /**
   * Calculate standard deviation
   */
  static standardDeviation(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(variance);
  }
  
  /**
   * Check if a point is within a circle
   */
  static pointInCircle(px: number, py: number, cx: number, cy: number, radius: number): boolean {
    const distance = MathUtils.distance(px, py, cx, cy);
    return distance <= radius;
  }
  
  /**
   * Check if a point is within a rectangle
   */
  static pointInRect(px: number, py: number, rx: number, ry: number, rw: number, rh: number): boolean {
    return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
  }
  
  /**
   * Convert degrees to radians
   */
  static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
  
  /**
   * Convert radians to degrees
   */
  static toDegrees(radians: number): number {
    return radians * (180 / Math.PI);
  }
  
  /**
   * Calculate exponential decay
   */
  static exponentialDecay(value: number, decayRate: number, time: number): number {
    return value * Math.exp(-decayRate * time);
  }
  
  /**
   * Calculate sigmoid function
   */
  static sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }
  
  /**
   * Calculate sigmoid with custom steepness
   */
  static sigmoidSteep(x: number, steepness: number = 1): number {
    return 1 / (1 + Math.exp(-steepness * x));
  }
} 