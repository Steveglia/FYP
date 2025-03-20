import type { Schema } from "../../data/resource";
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/api';

let outputs: any;
try {
  // Dynamically require the outputs; this will run at runtime
  outputs = require("../../../amplify_outputs.json");
} catch (err) {
  // Handle the case where the file is not yet available
  console.log('Amplify outputs not available:', err);
  outputs = {};
}

Amplify.configure(outputs);

const client = generateClient<Schema>();

// Config for the DFO algorithm
interface Config {
  NUM_DAYS: number;
  HOURS_PER_DAY: number;
  TOTAL_HOURS: number;
  REQUIRED_STUDY_HOURS: number;
  MAX_DAILY_HOURS: number;
  POPULATION_SIZE: number;
  GENERATIONS: number;
  DELTA: number;
}

// Study session interface
interface StudySession {
  day: string;
  hour: number;
}

// Fitness evaluator class
class FitnessEvaluator {
  config: Config;
  preferences: number[];
  singleHourBlockPenalty: number;
  longBlockPenalty: number;
  twoHourBlockBonus: number;

  constructor(
    config: Config, 
    preferences: number[], 
    singleHourBlockPenalty: number = 30,
    longBlockPenalty: number = 40,
    twoHourBlockBonus: number = 20
  ) {
    this.config = config;
    this.preferences = preferences;
    this.singleHourBlockPenalty = singleHourBlockPenalty;
    this.longBlockPenalty = longBlockPenalty;
    this.twoHourBlockBonus = twoHourBlockBonus;
  }

  calculateFitness(solution: number[]): number {
    // Calculate base reward from preferences
    let reward = 0;
    for (let i = 0; i < solution.length; i++) {
      reward += this.preferences[i] * solution[i] * 50;
    }

    // Calculate and subtract penalties
    const penalties = this.calculatePenalties(solution);
    
    // Add bonus for ideal block lengths (2 hours)
    const bonus = this.calculateBonus(solution);
    
    return reward - penalties + bonus;
  }

  calculateBonus(solution: number[]): number {
    let bonus = 0;
    let twoHourBlockCount = 0;
    
    for (let day = 0; day < this.config.NUM_DAYS; day++) {
      const dailySchedule = solution.slice(
        day * this.config.HOURS_PER_DAY,
        (day + 1) * this.config.HOURS_PER_DAY
      );
      
      let blockLength = 0;
      for (let hour = 0; hour < dailySchedule.length; hour++) {
        if (dailySchedule[hour] === 1) {
          blockLength++;
        } else if (blockLength > 0) {
          // Give bonus for 2-hour blocks (ideal study length)
          if (blockLength === 2) {
            bonus += this.twoHourBlockBonus;
            twoHourBlockCount++;
          }
          blockLength = 0;
        }
      }
      
      // Check last block of the day
      if (blockLength === 2) {
        bonus += this.twoHourBlockBonus;
        twoHourBlockCount++;
      }
    }
    
    this.lastBonusDetails = {
      twoHourBlockCount,
      totalBonus: bonus
    };
    
    return bonus;
  }

  calculatePenalties(solution: number[]): number {
    let penalties = 0;

    // ====== HARD CONSTRAINTS ======
    // 1. No study sessions at invalid time slots (preference <= 0)
    let invalidSlotCount = 0;
    for (let i = 0; i < solution.length; i++) {
      if (this.preferences[i] <= 0 && solution[i] === 1) {
        invalidSlotCount++;
        
        // Apply an extremely large penalty for slots with preference value 0 (user marked as unavailable)
        // This makes it virtually impossible for the algorithm to select these slots
        if (this.preferences[i] === 0) {
          // Using 100000 as an effectively infinite penalty
          penalties += 100000;
        } else {
          penalties += 1000;
        }
      }
    }
    
    // Keep track of invalid slots but don't add additional penalty (already added above)
    this.lastPenaltyDetails.invalidSlotCount = invalidSlotCount;

    // 2. Total study hours must match config
    const totalStudyHours = solution.reduce((sum, val) => sum + val, 0);
    const hoursDifference = Math.abs(totalStudyHours - this.config.REQUIRED_STUDY_HOURS);
    penalties += hoursDifference * 1000;

    // ====== SOFT CONSTRAINTS ======
    // 1. Study block constraints
    let singleHourBlockCount = 0;
    let longBlockCount = 0;
    let twoHourBlockCount = 0;
    
    for (let day = 0; day < this.config.NUM_DAYS; day++) {
      const dailySchedule = solution.slice(
        day * this.config.HOURS_PER_DAY,
        (day + 1) * this.config.HOURS_PER_DAY
      );
      
      let blockLength = 0;
      for (let hour = 0; hour < dailySchedule.length; hour++) {
        if (dailySchedule[hour] === 1) {
          blockLength++;
        } else if (blockLength > 0) {
          if (blockLength === 1) {
            // Single hour blocks are discouraged
            penalties += this.singleHourBlockPenalty;
            singleHourBlockCount++;
          } else if (blockLength === 2) {
            // Two-hour blocks are ideal (tracked for logging)
            twoHourBlockCount++;
          } else if (blockLength > 2) {
            // Longer blocks get progressively higher penalties
            const excessLength = blockLength - 2;
            penalties += excessLength * this.longBlockPenalty;
            longBlockCount++;
          }
          blockLength = 0;
        }
      }
      
      // Check last block of the day
      if (blockLength > 0) {
        if (blockLength === 1) {
          penalties += this.singleHourBlockPenalty;
          singleHourBlockCount++;
        } else if (blockLength === 2) {
          // Two-hour blocks are ideal (tracked for logging)
          twoHourBlockCount++;
        } else if (blockLength > 2) {
          const excessLength = blockLength - 2;
          penalties += excessLength * this.longBlockPenalty;
          longBlockCount++;
        }
      }
    }

    // 2. Maximum daily hours constraint
    let daysExceedingMaxHours = 0;
    for (let day = 0; day < this.config.NUM_DAYS; day++) {
      const dailyHours = solution
        .slice(day * this.config.HOURS_PER_DAY, (day + 1) * this.config.HOURS_PER_DAY)
        .reduce((sum, val) => sum + val, 0);
      
      if (dailyHours > this.config.MAX_DAILY_HOURS) {
        const excess = dailyHours - this.config.MAX_DAILY_HOURS;
        penalties += excess * 100;
        daysExceedingMaxHours++;
      }
    }
    
    // For detailed logging, we can return these counts
    this.lastPenaltyDetails = {
      invalidSlotCount,
      hoursDifference,
      singleHourBlockCount,
      twoHourBlockCount,
      longBlockCount,
      daysExceedingMaxHours
    };

    return penalties;
  }
  
  // Store the last penalty details for logging
  lastPenaltyDetails: {
    invalidSlotCount: number;
    hoursDifference: number;
    singleHourBlockCount: number;
    twoHourBlockCount: number;
    longBlockCount: number;
    daysExceedingMaxHours: number;
  } = {
    invalidSlotCount: 0,
    hoursDifference: 0,
    singleHourBlockCount: 0,
    twoHourBlockCount: 0,
    longBlockCount: 0,
    daysExceedingMaxHours: 0
  };
  
  // Store the last bonus details for logging
  lastBonusDetails: {
    twoHourBlockCount: number;
    totalBonus: number;
  } = {
    twoHourBlockCount: 0,
    totalBonus: 0
  };
  
  // Get penalty details for the last evaluated solution
  getLastPenaltyDetails() {
    return this.lastPenaltyDetails;
  }
  
  // Get bonus details for the last evaluated solution
  getLastBonusDetails() {
    return this.lastBonusDetails;
  }
}

// Hill Climber Algorithm implementation
class HillClimberAlgorithm {
  config: Config;
  fitnessEvaluator: FitnessEvaluator;
  
  constructor(config: Config, fitnessEvaluator: FitnessEvaluator) {
    this.config = config;
    this.fitnessEvaluator = fitnessEvaluator;
    
    // Hill climbing parameters
    this.maxIterations = 5;  // Maximum iterations without improvement
    this.maxNeighbors = 2;   // Maximum neighbors to evaluate per iteration
  }
  
  private maxIterations: number;
  private maxNeighbors: number;
  
  optimize(solution: number[]): number[] {
    let currentSolution = [...solution];
    let currentFitness = this.fitnessEvaluator.calculateFitness(currentSolution);
    
    let iterationsWithoutImprovement = 0;
    while (iterationsWithoutImprovement < this.maxIterations) {
      // Generate and evaluate neighbors
      let bestNeighbor: number[] | null = null;
      let bestNeighborFitness = currentFitness;
      
      // Generate multiple neighbors and evaluate them
      const neighbors = this.generateNeighbors(currentSolution);
      for (const neighbor of neighbors) {
        const neighborFitness = this.fitnessEvaluator.calculateFitness(neighbor);
        if (neighborFitness > bestNeighborFitness) {
          bestNeighbor = neighbor;
          bestNeighborFitness = neighborFitness;
        }
      }
      
      // If no better neighbor found, we're at a local optimum
      if (!bestNeighbor) {
        iterationsWithoutImprovement++;
        continue;
      }
      
      // Move to the best neighbor
      currentSolution = bestNeighbor;
      currentFitness = bestNeighborFitness;
      iterationsWithoutImprovement = 0;
    }
    
    return currentSolution;
  }
  
  private generateNeighbors(solution: number[]): number[][] {
    const neighbors: number[][] = [];
    const solutionHours = solution.reduce((sum, val) => sum + val, 0);
    
    for (let i = 0; i < this.maxNeighbors; i++) {
      const neighbor = [...solution];
      const moveType = Math.random() < 0.33 ? 'swap' : Math.random() < 0.66 ? 'block_swap' : 'shift';
      
      if (moveType === 'swap') {
        // Swap two hours (one 1 and one 0)
        const ones: number[] = [];
        const zeros: number[] = [];
        
        for (let j = 0; j < neighbor.length; j++) {
          if (neighbor[j] === 1) ones.push(j);
          else zeros.push(j);
        }
        
        if (ones.length > 0 && zeros.length > 0) {
          const oneIdx = ones[Math.floor(Math.random() * ones.length)];
          const zeroIdx = zeros[Math.floor(Math.random() * zeros.length)];
          neighbor[oneIdx] = 0;
          neighbor[zeroIdx] = 1;
        }
      }
      else if (moveType === 'block_swap') {
        // Reshape into days x hours
        const schedule: number[][] = [];
        for (let day = 0; day < this.config.NUM_DAYS; day++) {
          schedule.push(
            neighbor.slice(day * this.config.HOURS_PER_DAY, (day + 1) * this.config.HOURS_PER_DAY)
          );
        }
        
        // Swap two blocks of hours
        if (this.config.NUM_DAYS >= 2) {
          const day1 = Math.floor(Math.random() * this.config.NUM_DAYS);
          let day2 = Math.floor(Math.random() * this.config.NUM_DAYS);
          while (day2 === day1) {
            day2 = Math.floor(Math.random() * this.config.NUM_DAYS);
          }
          
          // Find study blocks in both days
          const blocks1 = this.findBlocks(schedule[day1]);
          const blocks2 = this.findBlocks(schedule[day2]);
          
          if (blocks1.length > 0 && blocks2.length > 0) {
            const block1 = blocks1[Math.floor(Math.random() * blocks1.length)];
            const block2 = blocks2[Math.floor(Math.random() * blocks2.length)];
            
            // Swap the blocks if they're the same size
            if (block1.length === block2.length) {
              const temp = [...block1.map(idx => schedule[day1][idx])];
              
              for (let j = 0; j < block1.length; j++) {
                schedule[day1][block1[j]] = schedule[day2][block2[j]];
                schedule[day2][block2[j]] = temp[j];
              }
              
              // Flatten the schedule back to a 1D array
              neighbor.length = 0;
              for (const day of schedule) {
                neighbor.push(...day);
              }
            }
          }
        }
      }
      else { // shift
        // Reshape into days x hours
        const schedule: number[][] = [];
        for (let day = 0; day < this.config.NUM_DAYS; day++) {
          schedule.push(
            neighbor.slice(day * this.config.HOURS_PER_DAY, (day + 1) * this.config.HOURS_PER_DAY)
          );
        }
        
        const day = Math.floor(Math.random() * this.config.NUM_DAYS);
        const ones: number[] = [];
        
        for (let j = 0; j < schedule[day].length; j++) {
          if (schedule[day][j] === 1) ones.push(j);
        }
        
        if (ones.length > 0) {
          const hourIdx = ones[Math.floor(Math.random() * ones.length)];
          
          if (hourIdx > 0 && schedule[day][hourIdx - 1] === 0) {
            schedule[day][hourIdx] = 0;
            schedule[day][hourIdx - 1] = 1;
          }
          else if (hourIdx < this.config.HOURS_PER_DAY - 1 && schedule[day][hourIdx + 1] === 0) {
            schedule[day][hourIdx] = 0;
            schedule[day][hourIdx + 1] = 1;
          }
          
          // Flatten the schedule back to a 1D array
          neighbor.length = 0;
          for (const day of schedule) {
            neighbor.push(...day);
          }
        }
      }
      
      // Only add the neighbor if it maintains the required study hours
      if (neighbor.reduce((sum, val) => sum + val, 0) === solutionHours) {
        neighbors.push(neighbor);
      }
    }
    
    return neighbors;
  }
  
  private findBlocks(daySchedule: number[]): number[][] {
    const blocks: number[][] = [];
    let currentBlock: number[] = [];
    
    for (let i = 0; i < daySchedule.length; i++) {
      if (daySchedule[i] === 1) {
        currentBlock.push(i);
      } else if (currentBlock.length > 0) {
        blocks.push([...currentBlock]);
        currentBlock = [];
      }
    }
    
    if (currentBlock.length > 0) {
      blocks.push(currentBlock);
    }
    
    return blocks;
  }
}

// Update DFOBest class to use hill climber and add more logging
class DFOBest {
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

// Format study sessions for output
function formatStudySessions(
  weekdays: string[],
  solution: number[],
  hoursPerDay: number,
  courses: string[]
): any[] {
  const sessions: any[] = [];
  
  for (let i = 0; i < solution.length; i++) {
    if (solution[i] === 1) {
      const dayIndex = Math.floor(i / hoursPerDay);
      const hour = i % hoursPerDay;
      
      if (dayIndex < weekdays.length) {
        // Map the hour (0-14) to a reasonable daytime hour (8am-10pm)
        const startHour = hour + 8;
        const endHour = startHour + 1; // Single hour sessions
        
        // Format with leading zeros
        const startTime = `${String(startHour).padStart(2, '0')}:00`;
        const endTime = `${String(endHour).padStart(2, '0')}:00`;
        
        // If no courses are available, use a default course name
        const courseIndex = sessions.length % Math.max(1, courses.length);
        const courseName = courses.length > 0 
          ? courses[courseIndex] 
          : 'General Study';
        
        sessions.push({
          day: weekdays[dayIndex],
          startTime,
          endTime,
          course: courseName
        });
      }
    }
  }
  
  return sessions;
}

export const handler: Schema["generateStudySessions"]["functionHandler"] = async (event) => {
  console.log('generateStudySessions handler called with arguments:', JSON.stringify(event.arguments));
  
  const { preferenceVector, userId } = event.arguments;

  console.log('preferenceVector:', preferenceVector);
  
  // Define weekdays
  const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  // Parse the preference vector from string to array
  const weekVector = preferenceVector ? 
    JSON.parse(preferenceVector) : 
    new Array(105).fill(1);
  
  console.log('Parsed preference vector:', weekVector.length, 'elements');
  
  // Get user's study preferences
  console.log('Fetching study preferences for user:', userId);
  const studyPreferences = await client.models.StudyPreference.list({
    filter: { owner: { eq: userId || '' } }
  });
  
  console.log('Study preferences found:', studyPreferences.data.length);
  const studyPreference = studyPreferences.data[0];
  
  if (studyPreference) {
    console.log('Using study preferences:', JSON.stringify(studyPreference));
  } else {
    console.log('No study preferences found, using defaults');
  }
  
  // Default values if no preferences are found
  const maxHoursPerDay = studyPreference?.maxHoursPerDay || 4;
  const courses = studyPreference?.courses?.filter(course => typeof course === 'string') || [];
  // Fixed at 16 study sessions as per requirements
  const totalStudyHours = 16;
  
  console.log('Using maxHoursPerDay:', maxHoursPerDay);
  console.log('Using totalStudyHours:', totalStudyHours);
  console.log('Available courses:', courses);
  
  // Determine which days have available slots based on preference vector
  const availableDays: string[] = [];
  
  // Check each day to see if it has available slots
  weekDays.forEach((day, dayIndex) => {
    const dayVector = weekVector.slice(dayIndex * 15, (dayIndex + 1) * 15);
    // If any slot in the day has a value > 0, consider the day available
    if (dayVector.some((value: number) => value > 0)) {
      availableDays.push(day);
    }
  });
  
  console.log('Available days for study:', availableDays);
  
  // Increase the penalties to discourage single-hour blocks and long blocks
  const SINGLE_HOUR_BLOCK_PENALTY = 50; // Increased from 30
  const LONG_BLOCK_PENALTY = 80;        // Increased from 40
  const TWO_HOUR_BLOCK_BONUS = 30;      // Bonus for ideal 2-hour blocks
  
  // Configure the DFO algorithm
  const config: Config = {
    NUM_DAYS: availableDays.length,
    HOURS_PER_DAY: 15, // 8am to 10pm (15 hours)
    TOTAL_HOURS: availableDays.length * 15,
    REQUIRED_STUDY_HOURS: totalStudyHours,
    MAX_DAILY_HOURS: maxHoursPerDay,
    POPULATION_SIZE: 50,
    GENERATIONS: 100,
    DELTA: 0.009
  };
  
  console.log('DFO configuration:', JSON.stringify(config, null, 2));
  console.log('Penalty configuration:');
  console.log(`  - Single hour block penalty: ${SINGLE_HOUR_BLOCK_PENALTY}`);
  console.log(`  - Long block penalty: ${LONG_BLOCK_PENALTY}`);
  console.log(`  - Two hour block bonus: ${TWO_HOUR_BLOCK_BONUS}`);
  
  // Create a fitness evaluator with the preference vector and increased penalties
  const fitnessEvaluator = new FitnessEvaluator(
    config, 
    weekVector, 
    SINGLE_HOUR_BLOCK_PENALTY,
    LONG_BLOCK_PENALTY,
    TWO_HOUR_BLOCK_BONUS
  );
  
  // Create and run the DFO algorithm with hill climbing
  console.log('Running DFO algorithm with hill climbing to generate study sessions...');
  const dfo = new DFOBest(config, fitnessEvaluator);
  const [bestSolution, bestFitness] = dfo.run();
  
  console.log('DFO algorithm completed with fitness:', bestFitness);
  
  // Format the study sessions for display on the calendar
  const formattedSessions = formatStudySessions(
    availableDays,
    bestSolution,
    config.HOURS_PER_DAY,
    courses
  );
  
  console.log('Formatted study sessions:', JSON.stringify(formattedSessions, null, 2));
  
  // Log the study slots in a more readable format
  const studySlots: { day: string, hour: number }[] = [];
  for (let i = 0; i < bestSolution.length; i++) {
    if (bestSolution[i] === 1) {
      const dayIndex = Math.floor(i / config.HOURS_PER_DAY);
      const hour = i % config.HOURS_PER_DAY;
      if (dayIndex < availableDays.length) {
        studySlots.push({
          day: availableDays[dayIndex],
          hour: hour + 8 // Convert to actual hour (8am-10pm)
        });
      }
    }
  }
  console.log('Study slots:', JSON.stringify(studySlots, null, 2));
  
  // Verify that no unavailable slots have been selected
  let unavailableSlotSelected = false;
  let unavailableSlots: { day: string, hour: number, index: number }[] = [];
  
  for (let i = 0; i < bestSolution.length; i++) {
    if (bestSolution[i] === 1 && weekVector[i] === 0) {
      const dayIndex = Math.floor(i / config.HOURS_PER_DAY);
      const hour = i % config.HOURS_PER_DAY;
      unavailableSlotSelected = true;
      
      unavailableSlots.push({
        day: availableDays[dayIndex],
        hour: hour + 8,
        index: i
      });
    }
  }
  
  if (unavailableSlotSelected) {
    console.error('WARNING: Study sessions were scheduled during unavailable time slots:', JSON.stringify(unavailableSlots, null, 2));
  } else {
    console.log('Verification successful: No study sessions were scheduled during unavailable time slots');
  }
  
  // Return the formatted sessions as a JSON string
  return JSON.stringify(formattedSessions);
};
  