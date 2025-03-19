"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hlrService_1 = require("./hlrService");
/**
 * Sample test cases for the improved spaced repetition algorithm
 * This file demonstrates the effect of the new coefficients on half-life calculations
 */
// Sample 1: First-time learning with different scores
console.log('Sample 1: First-time learning with different scores (60 minutes study, medium difficulty)');
const scores = [50, 75, 90, 100];
scores.forEach(score => {
    const result = (0, hlrService_1.debugHalfLifeCalculation)(score, 60, 3, 0);
    console.log(`Score: ${score}%, Half-life: ${result.halfLife.toFixed(2)} days, Next review: ${Math.round(result.halfLife * 24)} hours`);
});
// Sample 2: Effect of study repetition (exponential growth)
console.log('\nSample 2: Effect of study repetition (75% score, 60 minutes study, medium difficulty)');
const repetitions = [1, 2, 3, 4, 5];
repetitions.forEach(count => {
    const result = (0, hlrService_1.debugHalfLifeCalculation)(75, 60, 3, 0, undefined, count);
    console.log(`Repetition #${count}, Half-life: ${result.halfLife.toFixed(2)} days, Next review: ${Math.round(result.halfLife * 24)} hours`);
});
// Sample 3: Effect of task complexity
console.log('\nSample 3: Effect of task complexity (75% score, 60 minutes study)');
const complexities = [1, 2, 3, 4, 5];
complexities.forEach(complexity => {
    const result = (0, hlrService_1.debugHalfLifeCalculation)(75, 60, complexity, 0);
    console.log(`Complexity: ${complexity}, Half-life: ${result.halfLife.toFixed(2)} days, Next review: ${Math.round(result.halfLife * 24)} hours`);
});
// Sample 4: Full learning progression example
console.log('\nSample 4: Full learning progression example');
// First study session (75% score)
const session1 = (0, hlrService_1.debugHalfLifeCalculation)(75, 60, 3, 0);
console.log(`Session 1 (75% score): Half-life: ${session1.halfLife.toFixed(2)} days`);
// Second study session (85% score) after initial half-life
const session2 = (0, hlrService_1.debugHalfLifeCalculation)(85, 60, 3, session1.halfLife, session1.halfLife, 2);
console.log(`Session 2 (85% score): Half-life: ${session2.halfLife.toFixed(2)} days`);
// Third study session (95% score) after second half-life
const session3 = (0, hlrService_1.debugHalfLifeCalculation)(95, 60, 3, session2.halfLife, session2.halfLife, 3);
console.log(`Session 3 (95% score): Half-life: ${session3.halfLife.toFixed(2)} days`);
// Fourth study session (98% score) after third half-life
const session4 = (0, hlrService_1.debugHalfLifeCalculation)(98, 60, 3, session3.halfLife, session3.halfLife, 4);
console.log(`Session 4 (98% score): Half-life: ${session4.halfLife.toFixed(2)} days`);
console.log('\nCurrent algorithm parameters:');
console.log(`BASE_CONSTANT: ${hlrService_1.SpacedRepetitionParams.BASE_CONSTANT}`);
console.log(`QUIZ_SCORE_FACTOR: ${hlrService_1.SpacedRepetitionParams.QUIZ_SCORE_FACTOR}`);
console.log(`STUDY_COUNT_FACTOR: ${hlrService_1.SpacedRepetitionParams.STUDY_COUNT_FACTOR}`);
console.log(`TIME_SINCE_REVIEW_FACTOR: ${hlrService_1.SpacedRepetitionParams.TIME_SINCE_REVIEW_FACTOR}`);
console.log(`MIN_HALF_LIFE: ${hlrService_1.SpacedRepetitionParams.MIN_HALF_LIFE} days`);
