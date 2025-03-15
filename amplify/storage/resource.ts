import { defineStorage } from '@aws-amplify/backend';
import { store_events } from '../functions/storeEvents/resource';
import { store_lectures } from '../functions/storeLectures/resource';
 
export const users_events = defineStorage({
  name: 'Users_Events',
  isDefault: true,
  access: (allow) => ({
    'newfiles/*': [
      allow.resource(store_events).to(['read']),
    ]
  })
});

export const lectures_data = defineStorage({
  name: 'Lectures_Data',
  access: (allow) => ({
    'lectures/*': [
      allow.resource(store_lectures).to(['read']),
    ]
  })
});
