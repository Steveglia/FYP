/**
 * Configuration parameters for the study schedule optimizer.
 */
interface Config {
  NUM_DAYS: number;
  HOURS_PER_DAY: number;
  TOTAL_HOURS: number;
  REQUIRED_STUDY_HOURS: number;
  MAX_DAILY_HOURS: number;
  POPULATION_SIZE: number;
  GENERATIONS: number;
  DELTA: number; // probability for random restart in position update
}

/**
 * Represents a study session slot with day and hour.
 */
export interface StudySession {
  day: string;
  hour: number; // 0-indexed hour in the day
}

/**
 * FitnessEvaluator computes the fitness of a given solution.
 * The solution is a flattened binary array of length TOTAL_HOURS.
 */
class FitnessEvaluator {
  config: Config;
  // For simplicity, we set all preferences to 1 (meaning all slots are valid).
  preferences: number[];

  constructor(config: Config) {
    this.config = config;
    // Initialize all slots with preference 1.
    this.preferences = Array(config.TOTAL_HOURS).fill(1);
  }

  calculateFitness(solution: number[]): number {
    // Reward: sum of (preference * slot * 50)
    let reward = 0;
    for (let i = 0; i < solution.length; i++) {
      reward += this.preferences[i] * solution[i] * 50;
    }
    const penalties = this.calculatePenalties(solution);
    return reward - penalties;
  }

  calculatePenalties(solution: number[]): number {
    let penalties = 0;
    // Hard Constraint 1: No study session in an invalid slot (if preference <= 0)
    for (let i = 0; i < solution.length; i++) {
      if (this.preferences[i] <= 0 && solution[i] === 1) {
        penalties += 1000;
      }
    }

    // Hard Constraint 2: Total study hours must equal REQUIRED_STUDY_HOURS
    const totalStudyHours = solution.reduce((sum, v) => sum + v, 0);
    penalties += Math.abs(totalStudyHours - this.config.REQUIRED_STUDY_HOURS) * 1000;

    // Soft Constraint 1: Penalize single-hour blocks and overly long blocks per day
    for (let day = 0; day < this.config.NUM_DAYS; day++) {
      const start = day * this.config.HOURS_PER_DAY;
      const end = start + this.config.HOURS_PER_DAY;
      const dailySchedule = solution.slice(start, end);
      let blockLength = 0;
      for (let hour of dailySchedule) {
        if (hour === 1) {
          blockLength++;
        } else if (blockLength > 0) {
          if (blockLength === 1) {
            penalties += 30;
          } else if (blockLength > 2) {
            penalties += (blockLength - 2) * 40;
          }
          blockLength = 0;
        }
      }
      // Last block in day
      if (blockLength > 0) {
        if (blockLength === 1) {
          penalties += 30;
        } else if (blockLength > 2) {
          penalties += (blockLength - 2) * 40;
        }
      }
    }

    // Soft Constraint 2: Maximum daily study hours
    for (let day = 0; day < this.config.NUM_DAYS; day++) {
      const start = day * this.config.HOURS_PER_DAY;
      const end = start + this.config.HOURS_PER_DAY;
      const dailyHours = solution.slice(start, end).reduce((sum, v) => sum + v, 0);
      if (dailyHours > this.config.MAX_DAILY_HOURS) {
        penalties += (dailyHours - this.config.MAX_DAILY_HOURS) * 100;
      }
    }

    return penalties;
  }
}

/**
 * A simple hill climber that attempts to improve a solution by swapping a study hour with a non-study hour.
 */
class HillClimber {
  config: Config;
  fitnessEvaluator: FitnessEvaluator;
  maxIterations: number = 5;
  maxNeighbors: number = 2;

  constructor(config: Config, fitnessEvaluator: FitnessEvaluator) {
    this.config = config;
    this.fitnessEvaluator = fitnessEvaluator;
  }

  optimize(solution: number[]): number[] {
    let currentSolution = [...solution];
    let currentFitness = this.fitnessEvaluator.calculateFitness(currentSolution);
    let iterationsWithoutImprovement = 0;

    while (iterationsWithoutImprovement < this.maxIterations) {
      let bestNeighbor: number[] | null = null;
      let bestNeighborFitness = currentFitness;

      // Try up to maxNeighbors random swaps
      for (let i = 0; i < this.maxNeighbors; i++) {
        const neighbor = this.generateNeighbor(currentSolution);
        const neighborFitness = this.fitnessEvaluator.calculateFitness(neighbor);
        if (neighborFitness > bestNeighborFitness) {
          bestNeighbor = neighbor;
          bestNeighborFitness = neighborFitness;
        }
      }

      if (bestNeighbor === null) {
        iterationsWithoutImprovement++;
      } else {
        currentSolution = bestNeighbor;
        currentFitness = bestNeighborFitness;
        iterationsWithoutImprovement = 0;
      }
    }

    return currentSolution;
  }

  generateNeighbor(solution: number[]): number[] {
    // Create a copy of the solution
    const neighbor = [...solution];
    // Find indices where value is 1 and where it is 0
    const ones = neighbor.map((v, i) => (v === 1 ? i : -1)).filter(i => i !== -1);
    const zeros = neighbor.map((v, i) => (v === 0 ? i : -1)).filter(i => i !== -1);
    if (ones.length === 0 || zeros.length === 0) return neighbor;
    // Swap one randomly chosen 1 with a randomly chosen 0
    const oneIdx = ones[Math.floor(Math.random() * ones.length)];
    const zeroIdx = zeros[Math.floor(Math.random() * zeros.length)];
    neighbor[oneIdx] = 0;
    neighbor[zeroIdx] = 1;
    // Ensure the total study hours remains constant
    return neighbor;
  }
}

/**
 * Implementation of the DFO_Best algorithm with hill climbing.
 */
class DFO_Best {
  config: Config;
  fitnessEvaluator: FitnessEvaluator;
  hillClimber: HillClimber;
  populationSize: number;
  dimensions: number;
  delta: number;
  lowerBound: number = 0;
  upperBound: number = 1;
  hillClimbingRate: number = 0.3;

  constructor(config: Config, fitnessEvaluator: FitnessEvaluator) {
    this.config = config;
    this.fitnessEvaluator = fitnessEvaluator;
    this.hillClimber = new HillClimber(config, fitnessEvaluator);
    this.populationSize = config.POPULATION_SIZE;
    this.dimensions = config.TOTAL_HOURS;
    this.delta = config.DELTA;
  }

  /**
   * Initializes the population by creating solutions that satisfy the required study hours.
   */
  initializePopulation(): number[][] {
    const population: number[][] = [];
    const totalSlots = this.dimensions;
    const required = this.config.REQUIRED_STUDY_HOURS;

    // For each individual, randomly choose "required" indices to set to 1.
    for (let i = 0; i < this.populationSize; i++) {
      const solution = Array(totalSlots).fill(0);
      // Create an array of indices [0, 1, ..., totalSlots-1]
      const indices = [...Array(totalSlots).keys()];
      // Shuffle indices
      for (let j = indices.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [indices[j], indices[k]] = [indices[k], indices[j]];
      }
      // Set the first "required" indices to 1
      for (let j = 0; j < required; j++) {
        solution[indices[j]] = 1;
      }
      population.push(solution);
    }
    return population;
  }

  /**
   * Optimizes the population by updating positions using DFO rules and applying hill climbing.
   */
  optimizePopulation(population: number[][]): number[][] {
    // Calculate fitness for all individuals
    const populationFitness = population.map(sol => this.fitnessEvaluator.calculateFitness(sol));
    // Find index of the best solution
    let bestIdx = 0;
    let bestFitness = populationFitness[0];
    for (let i = 1; i < populationFitness.length; i++) {
      if (populationFitness[i] > bestFitness) {
        bestFitness = populationFitness[i];
        bestIdx = i;
      }
    }
    const bestSolution = population[bestIdx];

    const newPopulation: number[][] = population.map(sol => [...sol]);

    // Update each individual (except the best) by moving toward a neighbor
    for (let i = 0; i < population.length; i++) {
      if (i === bestIdx) continue;

      // Select neighbor: choose between left and right neighbor (with cyclic wrap-around)
      const left = (i - 1 + population.length) % population.length;
      const right = (i + 1) % population.length;
      const leftFitness = this.fitnessEvaluator.calculateFitness(population[left]);
      const rightFitness = this.fitnessEvaluator.calculateFitness(population[right]);
      const bestNeighbor = leftFitness > rightFitness ? population[left] : population[right];

      // Create new position based on: X_new = X_neighbor + U * (X_best - X_current)
      const newPos: number[] = [];
      for (let d = 0; d < this.dimensions; d++) {
        const U = Math.random();
        let value = bestNeighbor[d] + U * (bestSolution[d] - population[i][d]);
        // With probability delta, restart this coordinate randomly to 0 or 1
        if (Math.random() < this.delta) {
          value = Math.random() < 0.5 ? 0 : 1;
        }
        // Clip value to bounds and threshold to binary (using 0.5 as threshold)
        newPos[d] = value > 0.5 ? 1 : 0;
      }
      newPopulation[i] = newPos;
    }

    // Apply hill climbing to a portion of the population (always include the best)
    const indicesForClimbing = new Set<number>();
    indicesForClimbing.add(bestIdx);
    const numHillClimb = Math.max(1, Math.floor(this.hillClimbingRate * this.populationSize));
    while (indicesForClimbing.size < numHillClimb) {
      const idx = Math.floor(Math.random() * population.length);
      indicesForClimbing.add(idx);
    }
    indicesForClimbing.forEach(idx => {
      newPopulation[idx] = this.hillClimber.optimize(newPopulation[idx]);
    });

    return newPopulation;
  }

  /**
   * Runs the DFO_Best algorithm for a fixed number of generations.
   */
  run(): { bestSolution: number[]; bestFitness: number } {
    let population = this.initializePopulation();
    let bestSolution: number[] = [];
    let bestFitness = -Infinity;

    for (let gen = 0; gen < this.config.GENERATIONS; gen++) {
      population = this.optimizePopulation(population);
      // Evaluate current best in population
      for (let sol of population) {
        const fitness = this.fitnessEvaluator.calculateFitness(sol);
        if (fitness > bestFitness) {
          bestFitness = fitness;
          bestSolution = [...sol];
        }
      }
    }

    return { bestSolution, bestFitness };
  }
}

/**
 * Given an array of weekdays (strings), this function uses the DFO_Best algorithm
 * to generate a study schedule. The schedule is returned as a list of StudySession objects,
 * each with a day and an hour (0-indexed).
 *
 * The configuration is set based on the number of weekdays provided, with a default
 * of 12 hours per day and 20 total study hours (or adjusted if there are fewer total slots).
 */
export function generateStudySchedule(weekdays: string[]): StudySession[] {
  // Set up configuration based on the number of weekdays provided.
  const NUM_DAYS = weekdays.length;
  const HOURS_PER_DAY = 12;
  const TOTAL_HOURS = NUM_DAYS * HOURS_PER_DAY;
  // Ensure required study hours does not exceed total slots.
  const REQUIRED_STUDY_HOURS = Math.min(20, TOTAL_HOURS);
  const config: Config = {
    NUM_DAYS,
    HOURS_PER_DAY,
    TOTAL_HOURS,
    REQUIRED_STUDY_HOURS,
    MAX_DAILY_HOURS: 8,
    POPULATION_SIZE: 50,
    GENERATIONS: 50,
    DELTA: 0.009,
  };

  const fitnessEvaluator = new FitnessEvaluator(config);
  const dfoBest = new DFO_Best(config, fitnessEvaluator);
  const { bestSolution } = dfoBest.run();

  // Convert the flattened binary solution into a list of study sessions.
  const sessions: StudySession[] = [];
  for (let i = 0; i < bestSolution.length; i++) {
    if (bestSolution[i] === 1) {
      const dayIndex = Math.floor(i / HOURS_PER_DAY);
      const hour = i % HOURS_PER_DAY;
      sessions.push({ day: weekdays[dayIndex], hour });
    }
  }
  return sessions;
} 