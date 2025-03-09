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
   * Latin Hypercube Sampling.
   * For each column (dimension) in the LHS matrix, we generate samples that are evenly
   * distributed across [0, 1] with added randomness.
   */
  function lhs(numDimensions: number, numSamples: number): number[][] {
    const result: number[][] = Array.from({ length: numSamples }, () =>
      new Array(numDimensions).fill(0)
    );
    for (let j = 0; j < numDimensions; j++) {
      const intervals: number[] = [];
      for (let i = 0; i < numSamples; i++) {
        intervals.push((i + Math.random()) / numSamples);
      }
      for (let i = intervals.length - 1; i > 0; i--) {
        const k = Math.floor(Math.random() * (i + 1));
        [intervals[i], intervals[k]] = [intervals[k], intervals[i]];
      }
      for (let i = 0; i < numSamples; i++) {
        result[i][j] = intervals[i];
      }
    }
    return result;
  }
  
  /**
   * Helper function to adjust a solution so that it has exactly requiredOnes ones.
   */
  function adjustSolution(solution: number[], requiredOnes: number): number[] {
    let currentOnes = solution.reduce((sum, val) => sum + val, 0);
    const indices = [...Array(solution.length).keys()];
  
    // If there are too many ones, randomly switch some 1s to 0s.
    while (currentOnes > requiredOnes) {
      const onesIndices = indices.filter(i => solution[i] === 1);
      const removeIdx = onesIndices[Math.floor(Math.random() * onesIndices.length)];
      solution[removeIdx] = 0;
      currentOnes--;
    }
    // If there are too few ones, randomly switch some 0s to 1s.
    while (currentOnes < requiredOnes) {
      const zeroIndices = indices.filter(i => solution[i] === 0);
      const addIdx = zeroIndices[Math.floor(Math.random() * zeroIndices.length)];
      solution[addIdx] = 1;
      currentOnes++;
    }
    return solution;
  }
  
  /**
   * FitnessEvaluator computes the fitness of a given solution.
   * The solution is a flattened binary array of length TOTAL_HOURS.
   */
  class FitnessEvaluator {
    config: Config;
    // Default: all slots have a positive preference of 1.
    preferences: number[];
  
    constructor(config: Config) {
      this.config = config;
      this.preferences = Array(config.TOTAL_HOURS).fill(1);
    }
  
    calculateFitness(solution: number[]): number {
      let reward = 0;
      // Reward: sum of (preference * slot * 50)
      for (let i = 0; i < solution.length; i++) {
        reward += this.preferences[i] * solution[i] * 50;
      }
      const penalties = this.calculatePenalties(solution);
      return reward - penalties;
    }
  
    calculatePenalties(solution: number[]): number {
      let penalties = 0;
      // Hard Constraint 1: Penalize any scheduled slot with non-positive preference.
      for (let i = 0; i < solution.length; i++) {
        if (this.preferences[i] <= 0 && solution[i] === 1) {
          penalties += 1000;
        }
      }
      // Hard Constraint 2: Total study hours must equal REQUIRED_STUDY_HOURS.
      const totalStudyHours = solution.reduce((sum, v) => sum + v, 0);
      penalties += Math.abs(totalStudyHours - this.config.REQUIRED_STUDY_HOURS) * 1000;
  
      // Soft Constraint 1: Penalize single-hour blocks and overly long blocks per day.
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
        if (blockLength > 0) {
          if (blockLength === 1) {
            penalties += 30;
          } else if (blockLength > 2) {
            penalties += (blockLength - 2) * 40;
          }
        }
      }
  
      // Soft Constraint 2: Maximum daily study hours.
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
      const neighbor = [...solution];
      // Find indices of 1s and 0s
      const ones = neighbor.map((v, i) => (v === 1 ? i : -1)).filter(i => i !== -1);
      const zeros = neighbor.map((v, i) => (v === 0 ? i : -1)).filter(i => i !== -1);
      
      if (ones.length === 0 || zeros.length === 0) return neighbor;
      
      // Sort ones by preference (lowest first, so we replace low preference slots)
      ones.sort((a, b) => this.fitnessEvaluator.preferences[a] - this.fitnessEvaluator.preferences[b]);
      
      // Sort zeros by preference (highest first, so we add high preference slots)
      zeros.sort((a, b) => this.fitnessEvaluator.preferences[b] - this.fitnessEvaluator.preferences[a]);
      
      // Take one of the lowest preference 1s and one of the highest preference 0s
      const oneIdx = ones[Math.floor(Math.random() * Math.min(3, ones.length))];
      const zeroIdx = zeros[Math.floor(Math.random() * Math.min(3, zeros.length))];
      
      neighbor[oneIdx] = 0;
      neighbor[zeroIdx] = 1;
      return neighbor;
    }
  }
  
  /**
   * Implementation of the DFO_Best algorithm with hill climbing.
   * This version uses Latin Hypercube Sampling (LHS) to initialize the population
   * and adjusts each solution to preserve the required number of study sessions.
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
    // Add tracking for fitness progress
    fitnessHistory: number[] = [];
  
    constructor(config: Config, fitnessEvaluator: FitnessEvaluator) {
      this.config = config;
      this.fitnessEvaluator = fitnessEvaluator;
      this.hillClimber = new HillClimber(config, fitnessEvaluator);
      this.populationSize = config.POPULATION_SIZE;
      this.dimensions = config.TOTAL_HOURS;
      this.delta = config.DELTA;
    }
  
    /**
     * Initializes the population using Latin Hypercube Sampling over valid indices
     * (only those time slots with a positive preference).
     */
    initializePopulation(): number[][] {
      const population: number[][] = [];
      const validIndices: number[] = [];
      for (let i = 0; i < this.dimensions; i++) {
        if (this.fitnessEvaluator.preferences[i] > 0) {
          validIndices.push(i);
        }
      }
      const numValid = validIndices.length;
      const lhsSamples = lhs(numValid, this.populationSize);
  
      for (let i = 0; i < this.populationSize; i++) {
        const solution = Array(this.dimensions).fill(0);
        // Sort indices by preference value (highest first) and then by LHS sample
        const sortedIndices = validIndices
          .slice()
          .sort((a, b) => {
            // First sort by preference value (highest first)
            const prefDiff = this.fitnessEvaluator.preferences[b] - this.fitnessEvaluator.preferences[a];
            if (prefDiff !== 0) return prefDiff;
            // If preferences are equal, use LHS sample
            return lhsSamples[i][validIndices.indexOf(a)] - lhsSamples[i][validIndices.indexOf(b)];
          });
        const selected = sortedIndices.slice(0, this.config.REQUIRED_STUDY_HOURS);
        selected.forEach(idx => (solution[idx] = 1));
        population.push(solution);
      }
      return population;
    }
  
    /**
     * Optimizes the population by updating positions using DFO rules and applying hill climbing.
     */
    optimizePopulation(population: number[][]): number[][] {
      const populationFitness = population.map(sol => this.fitnessEvaluator.calculateFitness(sol));
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
  
      for (let i = 0; i < population.length; i++) {
        if (i === bestIdx) continue;
        const left = (i - 1 + population.length) % population.length;
        const right = (i + 1) % population.length;
        const leftFitness = this.fitnessEvaluator.calculateFitness(population[left]);
        const rightFitness = this.fitnessEvaluator.calculateFitness(population[right]);
        const bestNeighbor = leftFitness > rightFitness ? population[left] : population[right];
  
        const newPos: number[] = [];
        for (let d = 0; d < this.dimensions; d++) {
          const U = Math.random();
          let value = bestNeighbor[d] + U * (bestSolution[d] - population[i][d]);
          if (Math.random() < this.delta) {
            // When doing random restart, bias toward high preference slots
            if (this.fitnessEvaluator.preferences[d] > 0) {
              value = Math.random() < (this.fitnessEvaluator.preferences[d] / 100) ? 1 : 0;
            } else {
              value = 0; // Never select negative preference slots in random restart
            }
          }
          newPos[d] = value > 0.5 ? 1 : 0;
        }
        newPopulation[i] = adjustSolution(newPos, this.config.REQUIRED_STUDY_HOURS);
      }
  
      // Apply hill climbing to a portion of the population (always include the best).
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
    run(): { bestSolution: number[]; bestFitness: number; fitnessHistory: number[] } {
      let population = this.initializePopulation();
      let bestSolution: number[] = [];
      let bestFitness = -Infinity;
      this.fitnessHistory = [];
  
      // Log initial population fitness
      const initialFitness = population.map(sol => this.fitnessEvaluator.calculateFitness(sol));
      const initialBestFitness = Math.max(...initialFitness);
      console.log(`Initial best fitness: ${initialBestFitness}`);
      this.fitnessHistory.push(initialBestFitness);
  
      for (let gen = 0; gen < this.config.GENERATIONS; gen++) {
        population = this.optimizePopulation(population);
        
        // Track best fitness in this generation
        let genBestFitness = -Infinity;
        let genBestSolution: number[] = [];
        
        for (let sol of population) {
          const fitness = this.fitnessEvaluator.calculateFitness(sol);
          if (fitness > genBestFitness) {
            genBestFitness = fitness;
            genBestSolution = [...sol];
          }
          
          if (fitness > bestFitness) {
            bestFitness = fitness;
            bestSolution = [...sol];
          }
        }
        
        this.fitnessHistory.push(genBestFitness);
        
        // Log progress every 10 generations
        if (gen % 10 === 0 || gen === this.config.GENERATIONS - 1) {
          console.log(`Generation ${gen}: Best fitness = ${genBestFitness}`);
        }
      }
      
      // Log final solution details
      console.log(`Final best fitness: ${bestFitness}`);
      console.log(`Fitness improvement: ${bestFitness - this.fitnessHistory[0]}`);
      
      return { bestSolution, bestFitness, fitnessHistory: this.fitnessHistory };
    }
  }
  
  /**
   * Options for study schedule generation.
   */
  interface ScheduleOptions {
    maxDailyHours?: number;
    totalStudyHours?: number;
  }
  
  /**
   * Given an array of weekdays (strings) and an optional preference vector,
   * this function uses the DFO_Best algorithm (with Latin Hypercube Sampling) to generate a study schedule.
   * The schedule is returned as a list of StudySession objects.
   *
   * @param weekdays Array of weekday names.
   * @param preferenceVector Optional array of preference values (0-1) for each time slot.
   * @param options Optional configuration parameters.
   */
  export function generateStudySchedule(
    weekdays: string[],
    preferenceVector?: number[],
    options?: ScheduleOptions
  ): StudySession[] {
    const NUM_DAYS = weekdays.length;
    const HOURS_PER_DAY = 12;
    const TOTAL_HOURS = NUM_DAYS * HOURS_PER_DAY;
    const MAX_DAILY_HOURS = options?.maxDailyHours || 4;
    const REQUIRED_STUDY_HOURS = Math.min(options?.totalStudyHours || 20, TOTAL_HOURS);
  
    const config: Config = {
      NUM_DAYS,
      HOURS_PER_DAY,
      TOTAL_HOURS,
      REQUIRED_STUDY_HOURS,
      MAX_DAILY_HOURS,
      POPULATION_SIZE: 50,
      GENERATIONS: 100,
      DELTA: 0.009,
    };
  
    const fitnessEvaluator = new FitnessEvaluator(config);
  
    // Define weekdayIndices outside the conditional block so it's available throughout the function
    const weekdayIndices = weekdays.map(day => {
      const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      return dayNames.indexOf(day);
    });
  
    // If a preference vector is provided, map it to the local schedule.
    if (preferenceVector && preferenceVector.length > 0) {
      console.log("Using preference vector with length:", preferenceVector.length);
      console.log("First few preference values:", preferenceVector.slice(0, 15));
      
      // Log the highest preference values and their indices
      const sortedPrefs = [...preferenceVector].map((val, idx) => ({val, idx}))
        .filter(item => item.val > 0)
        .sort((a, b) => b.val - a.val);
      console.log("Top 10 preference values:", sortedPrefs.slice(0, 10));
      
      // Invert the preference values so that higher values (9) are more preferred
      // This is because the algorithm is trying to maximize the fitness
      const maxPref = Math.max(...preferenceVector.filter(p => p > 0));
      console.log("Max preference value:", maxPref);
      
      // Instead of inverting, let's use the values directly but scale them
      const mappedPreferences = new Array(TOTAL_HOURS).fill(0);
      
      console.log("Weekday indices:", weekdayIndices);
      
      for (let localDayIndex = 0; localDayIndex < NUM_DAYS; localDayIndex++) {
        const globalDayIndex = weekdayIndices[localDayIndex];
        if (globalDayIndex !== -1) {
          // Map the 12 hours in our algorithm (0-11) to the 15 hours in the preference vector (8am-10pm)
          for (let hour = 0; hour < HOURS_PER_DAY; hour++) {
            const localIndex = localDayIndex * HOURS_PER_DAY + hour;
            // Map our 0-11 hour to the 8-22 hour range in the preference vector
            // This assumes the preference vector starts at 8am (index 0) and goes to 10pm (index 14)
            const preferenceIndex = globalDayIndex * 15 + hour;
            
            if (preferenceIndex >= 0 && preferenceIndex < preferenceVector.length) {
              const prefValue = preferenceVector[preferenceIndex];
              // Use the preference value directly, but scale it up to make differences more significant
              mappedPreferences[localIndex] = prefValue <= 0 ? -100 : prefValue * 100;
            } else {
              mappedPreferences[localIndex] = -100;
            }
          }
        }
      }
      
      // Log the mapped preferences
      console.log("First day mapped preferences:", mappedPreferences.slice(0, HOURS_PER_DAY));
      
      fitnessEvaluator.preferences = mappedPreferences;
      
      // Update calculateFitness to strongly prioritize high preference slots
      fitnessEvaluator.calculateFitness = function (solution: number[]): number {
        let reward = 0;
        for (let i = 0; i < solution.length; i++) {
          if (this.preferences[i] > 0) {
            // Square the preference value to make higher preferences much more valuable
            reward += (this.preferences[i] * this.preferences[i]) * solution[i];
          }
        }
        
        let penalties = 0;
        // Heavily penalize scheduling in slots with negative preference
        for (let i = 0; i < solution.length; i++) {
          if (this.preferences[i] < 0 && solution[i] === 1) {
            penalties += 100000;
          }
        }
        
        penalties += this.calculatePenalties(solution);
        return reward - penalties;
      };
    }
  
    const dfoBest = new DFO_Best(config, fitnessEvaluator);
    const { bestSolution, bestFitness, fitnessHistory } = dfoBest.run();
    
    // Log the fitness history summary
    console.log("Fitness history summary:", {
      start: fitnessHistory[0],
      end: fitnessHistory[fitnessHistory.length - 1],
      improvement: fitnessHistory[fitnessHistory.length - 1] - fitnessHistory[0],
      generations: fitnessHistory.length
    });
  
    // Analyze the best solution
    const selectedSlots = [];
    for (let i = 0; i < bestSolution.length; i++) {
      if (bestSolution[i] === 1) {
        const dayIndex = Math.floor(i / HOURS_PER_DAY);
        const hour = i % HOURS_PER_DAY;
        const prefValue = preferenceVector ? 
          preferenceVector[weekdayIndices[dayIndex] * 15 + hour] : 
          fitnessEvaluator.preferences[i];
        
        selectedSlots.push({
          day: weekdays[dayIndex],
          hour: hour + 8, // Map to actual hour (8am-7pm)
          preference: prefValue
        });
      }
    }
    
    // Sort by preference (descending) to see if high preference slots were selected
    selectedSlots.sort((a, b) => b.preference - a.preference);
    console.log("Selected slots by preference (top 10):", selectedSlots.slice(0, 10));
    
    // Now create the actual sessions
    const sessions: StudySession[] = [];
    for (let i = 0; i < bestSolution.length; i++) {
      if (bestSolution[i] === 1) {
        const dayIndex = Math.floor(i / HOURS_PER_DAY);
        const hour = i % HOURS_PER_DAY;
        // Don't add 8 here, let the handler handle the hour mapping
        sessions.push({ day: weekdays[dayIndex], hour });
      }
    }
    return sessions;
  }
  