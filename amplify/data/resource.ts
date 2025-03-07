import { type ClientSchema, a, defineData } from "@aws-amplify/backend";
import { store_events } from "../functions/storeEvents/resource";
import { generatePreferenceVector } from "../functions/generatePreferenceVector/resource";

const schema = a
  .schema({
    generatePreferenceVector: a
      .query()
      .arguments({
        availabilityVector: a.string(),
        userId: a.string(),
      })
      .returns(a.string())
      .handler(a.handler.function(generatePreferenceVector))
      .authorization(
        allow => [
          allow.publicApiKey(),
          allow.authenticated()
        ]
      ),
    CalendarEvent: a
      .model({
        title: a.string(),
        description: a.string(),
        startDate: a.string(),
        endDate: a.string(),
        location: a.string(),
        type: a.enum(['WORK', 'STUDY', 'MEETING', 'OTHER']),
      })
      .authorization(allow => [allow.publicApiKey()]),
      StudyPreference: a
      .model({
        studyTime: a.string(),
        maxHoursPerDay: a.integer(),
        lunchBreakStart: a.string(),
        lunchBreakDuration: a.integer(),
        studyDuringWork: a.boolean(),
        preferredTimeOfDay: a.enum(['MORNING', 'EVENING']),
        owner: a.string(),
        courses: a.string().array()
      })
      .authorization(allow => [allow.publicApiKey()]),
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