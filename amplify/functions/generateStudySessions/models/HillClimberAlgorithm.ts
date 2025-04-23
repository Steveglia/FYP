import { Config } from '../types';
import { FitnessEvaluator } from './FitnessEvaluator';

// Hill Climber Algorithm implementation
export class HillClimberAlgorithm {
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