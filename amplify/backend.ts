import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { users_events, lectures_data } from './storage/resource';
import { store_events } from './functions/storeEvents/resource';
import { generatePreferenceVector } from './functions/generatePreferenceVector/resource';
import { generateStudySessions } from './functions/generateStudySessions/resource';
import { EventType } from 'aws-cdk-lib/aws-s3';
import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications';
import { store_lectures } from './functions/storeLectures/resource';


const backend = defineBackend({
  auth,
  data,
  users_events,
  lectures_data,
  store_events,
  store_lectures,
  generatePreferenceVector,
  generateStudySessions
});

// Event notification for store_events function
backend.users_events.resources.bucket.addEventNotification(
  EventType.OBJECT_CREATED_PUT,
  new LambdaDestination(backend.store_events.resources.lambda),
  {
    prefix: 'newfiles/'
  }
);

// Event notification for store_lectures function
backend.lectures_data.resources.bucket.addEventNotification(
  EventType.OBJECT_CREATED_PUT,
  new LambdaDestination(backend.store_lectures.resources.lambda),
  {
    prefix: 'lectures/'
  }
);

