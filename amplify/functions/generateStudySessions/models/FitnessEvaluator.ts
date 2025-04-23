import { BonusDetails, Config, PenaltyDetails } from '../types';

// Fitness evaluator class
export class FitnessEvaluator {
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
  lastPenaltyDetails: PenaltyDetails = {
    invalidSlotCount: 0,
    hoursDifference: 0,
    singleHourBlockCount: 0,
    twoHourBlockCount: 0,
    longBlockCount: 0,
    daysExceedingMaxHours: 0
  };
  
  // Store the last bonus details for logging
  lastBonusDetails: BonusDetails = {
    twoHourBlockCount: 0,
    totalBonus: 0
  };
  
  // Get penalty details for the last evaluated solution
  getLastPenaltyDetails(): PenaltyDetails {
    return this.lastPenaltyDetails;
  }
  
  // Get bonus details for the last evaluated solution
  getLastBonusDetails(): BonusDetails {
    return this.lastBonusDetails;
  }
} 