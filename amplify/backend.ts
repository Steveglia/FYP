import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { users_events } from './storage/resource';
import { store_events } from './functions/storeEvents/resource';
import { generatePreferenceVector } from './functions/generatePreferenceVector/resource';
import { generateStudySessions } from './functions/generateStudySessions/resource';
import { EventType } from 'aws-cdk-lib/aws-s3';
import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications';

const backend = defineBackend({
  auth,
  data,
  users_events,
  store_events,
  generatePreferenceVector,
  generateStudySessions

});

backend.users_events.resources.bucket.addEventNotification(
  EventType.OBJECT_CREATED_PUT,
  new LambdaDestination(backend.store_events.resources.lambda),
  {
    prefix: 'newfiles/'
  }
);

