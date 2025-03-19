import { generateClient } from 'aws-amplify/api';
import { Amplify } from 'aws-amplify';
import config from '../amplifyconfiguration.json';

Amplify.configure(config);

const client = generateClient();

/**
 * This script deletes and recreates a personal learning item
 * to ensure all required fields are present.
 */
async function recreatePersonalLearningItem() {
  // Item details from your existing record
  const itemId = "2";
  const userId = "5642f224-d0c1-70e1-f72e-d75d0fdf3dd0";
  const subject = "Learn Python";
  const totalRequiredHours = 30;
  const weeklyDedicationHours = 2;
  
  try {
    // First try to delete the existing item
    console.log('Attempting to delete item with ID:', itemId);
    
    try {
      const deleteResult = await client.models.PersonalLearning.delete({
        id: itemId
      });
      
      if (deleteResult.errors) {
        console.warn('Warning during delete:', deleteResult.errors);
        // Continue anyway, as the item might not exist
      } else {
        console.log('Successfully deleted item');
      }
    } catch (deleteError) {
      console.warn('Warning during delete operation:', deleteError);
      // Continue anyway, as we want to recreate the item
    }
    
    // Create a new item with the same data
    console.log('Creating new personal learning item for user:', userId);
    
    const createResult = await client.models.PersonalLearning.create({
      userId: userId,
      subject: subject,
      totalRequiredHours: totalRequiredHours,
      weeklyDedicationHours: weeklyDedicationHours
    });
    
    if (createResult.errors) {
      console.error('Error creating item:', createResult.errors);
      return;
    }
    
    console.log('Successfully created personal learning item:', createResult.data);
  } catch (error) {
    console.error('Error in recreate operation:', error);
  }
}

// Execute the function
recreatePersonalLearningItem()
  .then(() => console.log('Script completed'))
  .catch(error => console.error('Script failed:', error)); 