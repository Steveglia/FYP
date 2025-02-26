import { defineStorage } from '@aws-amplify/backend';
import { store_events } from '../functions/storeEvents/resource';
 
export const users_events_storage = defineStorage({
  name: 'Users_Events_Storage',
  access: (allow) => ({
    'newfiles/*': [
      allow.resource(store_events).to(['read']),
    ]
  })
});
