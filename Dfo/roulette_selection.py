import numpy as np
from typing import List, Tuple

class RouletteSelection:
    """Roulette wheel selection strategy."""
    
    def select_parents(self, population: List[List[int]], fitness_scores: List[float]) -> Tuple[List[int], List[int]]:
        """Select two parents using roulette wheel selection."""
        # Shift fitness scores to positive if there are negative values
        min_fitness = min(fitness_scores)
        if min_fitness < 0:
            shifted_fitness = [f - min_fitness + 1e-10 for f in fitness_scores]
        else:
            shifted_fitness = [f + 1e-10 for f in fitness_scores]  # Add small constant to avoid zero probabilities
        
        # Calculate selection probabilities
        total_fitness = sum(shifted_fitness)
        probabilities = [f/total_fitness for f in shifted_fitness]
        
        # Select two parents using roulette wheel
        parent1_idx = np.random.choice(len(population), p=probabilities)
        parent2_idx = np.random.choice(len(population), p=probabilities)
        
        return population[parent1_idx], population[parent2_idx]
    
    @property
    def name(self) -> str:
        return "Roulette Wheel"
