# Implementation of Dispersive Flies Optimization with best-neighbor strategy
import random
import numpy as np
from typing import List, Tuple
from hill_climber_algorithm import HillClimberAlgorithm
from pyDOE import lhs

class DFO_Best:
    """Simplified DFO implementation with hill climbing after position updates"""
    
    def __init__(self, config, fitness_evaluator):
        """Initialize DFO with configuration and fitness evaluator"""
        self.config = config
        self.fitness_evaluator = fitness_evaluator
        self.hill_climber = HillClimberAlgorithm(config, fitness_evaluator)
        
        # Algorithm parameters
        self.population_size = config.POPULATION_SIZE
        self.dimensions = config.TOTAL_HOURS
        self.delta = 0.009  # Probability of random restart
        self.lower_bound = 0  # Binary solution space
        self.upper_bound = 1
        self.hill_climbing_rate = 0.3 # Apply hill climbing to 30% of population
        
    def initialize_population(self) -> List[List[int]]:
        """Initialize population using Latin Hypercube Sampling"""
        population = []
        
        # Get valid indices (where preference > 0)
        valid_indices = [i for i in range(self.config.TOTAL_HOURS) 
                        if self.fitness_evaluator.preferences[i] > 0]
        
        num_valid_slots = len(valid_indices)
        
        # Use Latin Hypercube Sampling for high dimensions
        lhs_samples = lhs(num_valid_slots, samples=self.population_size)
        
        for i in range(self.population_size):
            # Create a solution with all zeros
            solution = [0] * self.config.TOTAL_HOURS
            
            # Convert LHS samples to probabilities for this individual
            probabilities = lhs_samples[i]
            # Sort indices by their probabilities
            sorted_indices = [valid_indices[j] for j in np.argsort(probabilities)]
            
            # Select the first REQUIRED_STUDY_HOURS indices
            selected_indices = sorted_indices[:self.config.REQUIRED_STUDY_HOURS]
            
            # Set selected indices to 1
            for idx in selected_indices:
                solution[idx] = 1
            
            population.append(solution)
        
        return population

    def optimize_population(self, population: List[List[int]]) -> List[List[int]]:
        """Apply DFO position update mechanism followed by hill climbing"""
        # Calculate fitness for all solutions
        population_fitness = [(i, self.fitness_evaluator.calculate_fitness(pop)) 
                           for i, pop in enumerate(population)]
        
        # Find best solution index
        best_idx = max(population_fitness, key=lambda x: x[1])[0]
        
        new_population = [solution.copy() for solution in population]
        
        # Update each solution's position using DFO
        for i in range(len(population)):
            if i == best_idx:
                continue  # Skip the best solution (elitism)
            
            # Find best neighbor
            left = (i-1) % self.population_size
            right = (i+1) % self.population_size
            left_fitness = self.fitness_evaluator.calculate_fitness(population[left])
            right_fitness = self.fitness_evaluator.calculate_fitness(population[right])
            best_neighbor = left if left_fitness > right_fitness else right
            
            # Generate random weights for position update
            U = np.random.uniform(0, 1, self.dimensions)
            
            # Update position: X = Xn + U * (Xs - X)
            new_pos = np.add(
                population[best_neighbor],
                np.multiply(U, np.subtract(population[best_idx], population[i]))
            )
            
            # Random restart with probability delta
            restart_mask = np.random.uniform(0, 1, self.dimensions) < self.delta
            restart_pos = np.random.randint(self.lower_bound, self.upper_bound + 1, self.dimensions)
            new_pos = np.where(restart_mask, restart_pos, new_pos)
            
            # Boundary handling
            new_pos = np.clip(new_pos, self.lower_bound, self.upper_bound)
            
            # Convert to binary solution
            new_pos = (new_pos > 0.5).astype(int)
            
            new_population[i] = new_pos.tolist()
        
        # Apply hill climbing to a portion of the population
        # Always include the best solution
        solutions_for_hill_climbing = [best_idx]
        
        # Select additional solutions for hill climbing
        num_hill_climb = max(1, int(self.hill_climbing_rate * self.population_size))
        candidates = list(range(len(population)))
        candidates.remove(best_idx)  # Remove best_idx as it's already selected
        solutions_for_hill_climbing.extend(
            random.sample(candidates, min(num_hill_climb - 1, len(candidates)))
        )
        
        # Apply hill climbing to selected solutions
        for idx in solutions_for_hill_climbing:
            new_population[idx] = self.hill_climber.optimize(new_population[idx])
        
        return new_population

    def run(self) -> Tuple[List[int], float]:
        """Run the simplified DFO algorithm with hill climbing"""
        # Initialize population
        population = self.initialize_population()
        best_solution = None
        best_fitness = float('-inf')
        
        for iteration in range(self.config.GENERATIONS):
            # Optimize population using DFO and hill climbing
            population = self.optimize_population(population)
            
            # Evaluate current best solution
            current_best = max(population, 
                             key=lambda x: self.fitness_evaluator.calculate_fitness(x))
            current_best_fitness = self.fitness_evaluator.calculate_fitness(current_best)
            
            # Update best solution if improved
            if current_best_fitness > best_fitness:
                best_fitness = current_best_fitness
                best_solution = current_best.copy()
        
        return best_solution, best_fitness
