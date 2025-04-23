import { Config } from '../types';
import { FitnessEvaluator } from './FitnessEvaluator';
import { HillClimberAlgorithm } from './HillClimberAlgorithm';

// Update DFOBest class to use hill climber and add more logging
export class DFOBest {
  config: Config;
  fitnessEvaluator: FitnessEvaluator;
  hillClimber: HillClimberAlgorithm;
  
  constructor(config: Config, fitnessEvaluator: FitnessEvaluator) {
    this.config = config;
    this.fitnessEvaluator = fitnessEvaluator;
    this.hillClimber = new HillClimberAlgorithm(config, fitnessEvaluator);
    
    // Algorithm parameters
    this.hillClimbingRate = 0.3; // Apply hill climbing to 30% of population
  }
  
  private hillClimbingRate: number;

  // Initialize population with Latin Hypercube Sampling (simplified)
  initializePopulation(): number[][] {
    const population: number[][] = [];
    
    // Get valid indices (where preference > 0)
    const validIndices: number[] = [];
    for (let i = 0; i < this.config.TOTAL_HOURS; i++) {
      if (this.fitnessEvaluator.preferences[i] > 0) {
        validIndices.push(i);
      }
    }
    
    for (let i = 0; i < this.config.POPULATION_SIZE; i++) {
      // Create a solution with all zeros
      const solution = new Array(this.config.TOTAL_HOURS).fill(0);
      
      // Shuffle valid indices and select the first REQUIRED_STUDY_HOURS
      const shuffledIndices = [...validIndices].sort(() => Math.random() - 0.5);
      const selectedIndices = shuffledIndices.slice(0, this.config.REQUIRED_STUDY_HOURS);
      
      // Set selected indices to 1
      for (const idx of selectedIndices) {
        solution[idx] = 1;
      }
      
      population.push(solution);
    }
    
    return population;
  }

  // Optimize population using DFO
  optimizePopulation(population: number[][]): number[][] {
    // Calculate fitness for all solutions
    const populationFitness = population.map((pop, i) => ({
      index: i,
      fitness: this.fitnessEvaluator.calculateFitness(pop)
    }));
    
    // Find best solution index
    const bestIdx = populationFitness.reduce(
      (maxIdx, curr, i) => curr.fitness > populationFitness[maxIdx].fitness ? i : maxIdx, 
      0
    );
    
    const newPopulation = population.map(solution => [...solution]);
    
    // Update each solution's position using DFO
    for (let i = 0; i < population.length; i++) {
      if (i === bestIdx) continue; // Skip the best solution (elitism)
      
      // Find best neighbor
      const left = (i - 1 + this.config.POPULATION_SIZE) % this.config.POPULATION_SIZE;
      const right = (i + 1) % this.config.POPULATION_SIZE;
      const leftFitness = this.fitnessEvaluator.calculateFitness(population[left]);
      const rightFitness = this.fitnessEvaluator.calculateFitness(population[right]);
      const bestNeighbor = leftFitness > rightFitness ? left : right;
      
      // Generate random weights for position update
      const U = Array(this.config.TOTAL_HOURS).fill(0).map(() => Math.random());
      
      // Update position: X = Xn + U * (Xs - X)
      const newPos = [];
      for (let j = 0; j < this.config.TOTAL_HOURS; j++) {
        // Calculate the new position value
        let value = population[bestNeighbor][j] + 
                    U[j] * (population[bestIdx][j] - population[i][j]);
        
        // Random restart with probability delta
        if (Math.random() < this.config.DELTA) {
          value = Math.random() > 0.5 ? 1 : 0;
        }
        
        // Boundary handling and convert to binary
        newPos.push(value > 0.5 ? 1 : 0);
      }
      
      newPopulation[i] = newPos;
    }
    
    // Apply hill climbing to a portion of the population
    // Always include the best solution
    const solutionsForHillClimbing: number[] = [bestIdx];
    
    // Select additional solutions for hill climbing
    const numHillClimb = Math.max(1, Math.floor(this.hillClimbingRate * this.config.POPULATION_SIZE));
    const candidates = Array.from({ length: population.length }, (_, i) => i)
      .filter(i => i !== bestIdx); // Remove best_idx as it's already selected
    
    // Randomly select solutions for hill climbing
    while (solutionsForHillClimbing.length < numHillClimb && candidates.length > 0) {
      const randomIndex = Math.floor(Math.random() * candidates.length);
      solutionsForHillClimbing.push(candidates[randomIndex]);
      candidates.splice(randomIndex, 1);
    }
    
    // Apply hill climbing to selected solutions
    for (const idx of solutionsForHillClimbing) {
      newPopulation[idx] = this.hillClimber.optimize(newPopulation[idx]);
    }
    
    return newPopulation;
  }

  // Run the DFO algorithm
  run(): [number[], number] {
    // Initialize population
    console.log(`Initializing population with size ${this.config.POPULATION_SIZE}`);
    let population = this.initializePopulation();
    let bestSolution: number[] = [];
    let bestFitness = Number.NEGATIVE_INFINITY;
    
    console.log(`Starting DFO optimization for ${this.config.GENERATIONS} generations`);
    for (let iteration = 0; iteration < this.config.GENERATIONS; iteration++) {
      // Optimize population using DFO
      population = this.optimizePopulation(population);
      
      // Evaluate current best solution
      let currentBestIndex = 0;
      let currentBestFitness = Number.NEGATIVE_INFINITY;
      
      for (let i = 0; i < population.length; i++) {
        const fitness = this.fitnessEvaluator.calculateFitness(population[i]);
        if (fitness > currentBestFitness) {
          currentBestFitness = fitness;
          currentBestIndex = i;
        }
      }
      
      // Update best solution if improved
      if (currentBestFitness > bestFitness) {
        bestFitness = currentBestFitness;
        bestSolution = [...population[currentBestIndex]];
        
        // Log progress every 10 iterations or when improvement happens
        if (iteration % 10 === 0 || currentBestFitness > bestFitness) {
          const penaltyDetails = this.fitnessEvaluator.getLastPenaltyDetails();
          const bonusDetails = this.fitnessEvaluator.getLastBonusDetails();
          console.log(`Generation ${iteration}: New best solution found with fitness ${bestFitness.toFixed(2)}`);
          console.log(`  - Single hour blocks: ${penaltyDetails.singleHourBlockCount}`);
          console.log(`  - Two hour blocks (ideal): ${penaltyDetails.twoHourBlockCount}`);
          console.log(`  - Long blocks (>2 hours): ${penaltyDetails.longBlockCount}`);
          console.log(`  - Days exceeding max hours: ${penaltyDetails.daysExceedingMaxHours}`);
          console.log(`Final solution bonus details:`);
          console.log(`  - Two hour blocks: ${bonusDetails.twoHourBlockCount}`);
          console.log(`  - Total bonus: ${bonusDetails.totalBonus}`);
        }
      }
      
      // Log progress every 20 iterations
      if (iteration % 20 === 0) {
        console.log(`Generation ${iteration}: Current best fitness: ${bestFitness.toFixed(2)}`);
      }
    }
    
    // Final evaluation of the best solution
    const finalFitness = this.fitnessEvaluator.calculateFitness(bestSolution);
    const penaltyDetails = this.fitnessEvaluator.getLastPenaltyDetails();
    const bonusDetails = this.fitnessEvaluator.getLastBonusDetails();
    
    console.log(`DFO optimization completed. Final fitness: ${finalFitness.toFixed(2)}`);
    console.log(`Final solution penalty details:`);
    console.log(`  - Invalid slot count: ${penaltyDetails.invalidSlotCount}`);
    console.log(`  - Hours difference from required: ${penaltyDetails.hoursDifference}`);
    console.log(`  - Single hour blocks: ${penaltyDetails.singleHourBlockCount}`);
    console.log(`  - Two hour blocks (ideal): ${penaltyDetails.twoHourBlockCount}`);
    console.log(`  - Long blocks (>2 hours): ${penaltyDetails.longBlockCount}`);
    console.log(`  - Days exceeding max hours: ${penaltyDetails.daysExceedingMaxHours}`);
    console.log(`Final solution bonus details:`);
    console.log(`  - Two hour blocks: ${bonusDetails.twoHourBlockCount}`);
    console.log(`  - Total bonus: ${bonusDetails.totalBonus}`);
    
    // Analyze the distribution of study hours
    this.analyzeStudyDistribution(bestSolution);
    
    return [bestSolution, finalFitness];
  }
  
  // Analyze the distribution of study hours across days
  private analyzeStudyDistribution(solution: number[]): void {
    const dailyHours: number[] = [];
    const dailyBlocks: { length: number, count: number }[][] = [];
    
    for (let day = 0; day < this.config.NUM_DAYS; day++) {
      const dailySchedule = solution.slice(
        day * this.config.HOURS_PER_DAY,
        (day + 1) * this.config.HOURS_PER_DAY
      );
      
      // Count hours per day
      const hours = dailySchedule.reduce((sum, val) => sum + val, 0);
      dailyHours.push(hours);
      
      // Find blocks
      const blocks: { length: number, count: number }[] = [];
      let blockLength = 0;
      
      for (let hour = 0; hour < dailySchedule.length; hour++) {
        if (dailySchedule[hour] === 1) {
          blockLength++;
        } else if (blockLength > 0) {
          // Add block to the list
          const existingBlock = blocks.find(b => b.length === blockLength);
          if (existingBlock) {
            existingBlock.count++;
          } else {
            blocks.push({ length: blockLength, count: 1 });
          }
          blockLength = 0;
        }
      }
      
      // Check last block of the day
      if (blockLength > 0) {
        const existingBlock = blocks.find(b => b.length === blockLength);
        if (existingBlock) {
          existingBlock.count++;
        } else {
          blocks.push({ length: blockLength, count: 1 });
        }
      }
      
      dailyBlocks.push(blocks);
    }
    
    // Log the distribution
    console.log('Study hours distribution by day:');
    for (let day = 0; day < this.config.NUM_DAYS; day++) {
      console.log(`  Day ${day + 1} (${day < this.config.NUM_DAYS ? this.getDayName(day) : 'Unknown'}):`);
      console.log(`    Total hours: ${dailyHours[day]}`);
      console.log(`    Blocks: ${JSON.stringify(dailyBlocks[day])}`);
    }
  }
  
  // Helper to get day name
  private getDayName(dayIndex: number): string {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return dayIndex < days.length ? days[dayIndex] : `Day ${dayIndex + 1}`;
  }
} 