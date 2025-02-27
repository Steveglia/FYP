import { type ClientSchema, a, defineData } from "@aws-amplify/backend";
import { store_events } from "../functions/storeEvents/resource";


const schema = a
  .schema({
    Event: a
      .model({
        title: a.string(),
        description: a.string(),
        startDate: a.string(),
        endDate: a.string(),
        location: a.string(),
      })
      .authorization(allow => [allow.publicApiKey()])
      ,
    StudyPreference: a
      .model({
        studyTime: a.string(),
        maxHoursPerDay: a.integer(),
        lunchBreakStart: a.string(),
        lunchBreakDuration: a.integer(),
        studyDuringWork: a.boolean(),
        preferredStartTime: a.string(),
        preferredEndTime: a.string(),
        owner: a.string(),
      })
      .authorization(allow => [allow.owner()]),
  })
  .authorization(allow => [
    allow.resource(store_events)])
  ;

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
   
    defaultAuthorizationMode: 'apiKey',
  },

});