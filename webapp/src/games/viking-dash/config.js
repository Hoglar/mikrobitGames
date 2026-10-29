// Versioned tempo and pacing. Rendering and tests consume the same values as the simulation.
export const VIKING_VERSION = 'viking-v3';
export const VIKING_TUNING = Object.freeze({
  startSpeed: 12,
  maxSpeed: 24,
  speedRampMeters: 1200,
  viewMeters: 40,
  lookaheadMeters: 60,
  environmentMeters: 250,
  duckMeters: 75,
  pitMeters: 150,
  combinationMeters: 300,
  eventWarningSeconds: 2,
  firstEvent: Object.freeze([3, 5]),
  visualDuration: Object.freeze([6, 9]),
  intenseDuration: Object.freeze([8, 11]),
  visualGap: Object.freeze([2, 3.5]),
  intenseGap: Object.freeze([3, 5]),
  obstacleGap: Object.freeze([2.1, 2.8]),
  intenseObstacleGap: Object.freeze([1.65, 2.15]),
  minimumActionSeconds: 1.2
});

export function speedAtDistance(distance) {
  return VIKING_TUNING.startSpeed + (VIKING_TUNING.maxSpeed - VIKING_TUNING.startSpeed) *
    Math.min(Math.max(0, distance) / VIKING_TUNING.speedRampMeters, 1);
}

export function randomBetween(random, range) {
  return range[0] + random() * (range[1] - range[0]);
}
