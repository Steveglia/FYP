import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { users_events_storage } from './storage/resource';
import { store_events } from './functions/storeEvents/resource';
import { EventType } from 'aws-cdk-lib/aws-s3';
import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications';

const backend = defineBackend({
  auth,
  data,
  users_events_storage,
  store_events,
  // imagesStorage,
});

backend.users_events_storage.resources.bucket.addEventNotification(
  EventType.OBJECT_CREATED_PUT,
  new LambdaDestination(backend.store_events.resources.lambda),
  {
    prefix: 'newfiles/'
  }
);

