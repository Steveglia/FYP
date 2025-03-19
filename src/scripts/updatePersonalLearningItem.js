import { generateClient } from 'aws-amplify/api';
import { Amplify } from 'aws-amplify';
import config from '../amplifyconfiguration.json';

Amplify.configure(config);

const client = generateClient();

/**
 * This script updates an existing personal learning item in the database
 * to add the missing createdAt and updatedAt fields.
 */
async function updatePersonalLearningItem() {
  const itemId = "2"; // The ID of the item to update
  
  try {
    console.log('Updating personal learning item with ID:', itemId);
    
    // Current timestamp in ISO format
    const timestamp = new Date().toISOString();
    
    const result = await client.models.PersonalLearning.update({
      id: itemId,
      createdAt: timestamp,
      updatedAt: timestamp
    });
    
    if (result.errors) {
      console.error('Error updating item:', result.errors);
      return;
    }
    
    console.log('Successfully updated personal learning item:', result.data);
  } catch (error) {
    console.error('Error updating personal learning item:', error);
  }
}

// Execute the function
updatePersonalLearningItem()
  .then(() => console.log('Script completed'))
  .catch(error => console.error('Script failed:', error)); 