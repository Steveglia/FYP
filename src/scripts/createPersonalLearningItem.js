import { generateClient } from 'aws-amplify/api';
import { Amplify } from 'aws-amplify';
import config from '../amplifyconfiguration.json';

Amplify.configure(config);

const client = generateClient();

/**
 * This script creates a personal learning item in the database.
 * Run it using: node -r esm createPersonalLearningItem.js
 */
async function createPersonalLearningItem() {
  const userId = "f6b2c294-d0b1-7015-75a7-de9fc2511d22"; // Replace with the actual user ID
  
  try {
    console.log('Creating personal learning item for user:', userId);
    
    const result = await client.models.PersonalLearning.create({
      userId: userId,
      subject: "Learn Python",
      totalRequiredHours: 30,
      weeklyDedicationHours: 2
    });
    
    if (result.errors) {
      console.error('Error creating item:', result.errors);
      return;
    }
    
    console.log('Successfully created personal learning item:', result.data);
  } catch (error) {
    console.error('Error creating personal learning item:', error);
  }
}

// Execute the function
createPersonalLearningItem()
  .then(() => console.log('Script completed'))
  .catch(error => console.error('Script failed:', error)); 