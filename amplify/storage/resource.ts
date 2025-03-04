import { defineStorage } from '@aws-amplify/backend';
import { store_events } from '../functions/storeEvents/resource';
 
export const users_events = defineStorage({
  name: 'Users_Events',
  access: (allow) => ({
    'newfiles/*': [
      allow.resource(store_events).to(['read']),
    ]
  })
});
