import { type ClientSchema, a, defineData } from "@aws-amplify/backend";
import { store_events } from "../functions/storeEvents/resource";
import { store_lectures } from "../functions/storeLectures/resource";
import { generatePreferenceVector } from "../functions/generatePreferenceVector/resource";
import { generateStudySessions } from "../functions/generateStudySessions/resource";
import { branchAndBound } from "../functions/branchAndBound/resource";

const schema = a
  .schema({
    generatePreferenceVector: a
      .query()
      .arguments({
        availabilityVector: a.string(),
        userId: a.string(),
        mode: a.string(),
      })
      .returns(
        a.string()
      )
      .handler(a.handler.function(generatePreferenceVector))
      .authorization(allow => [allow.publicApiKey()]),
      
    generateStudySessions: a
      .query()
      .arguments({
        preferenceVector: a.string(),
        userId: a.string(),
      })
      .returns(a.string())
      .handler(a.handler.function(generateStudySessions))
      .authorization(allow => [allow.publicApiKey()]),
      
    branchAndBound: a
      .query()
      .arguments({
        preferenceVector: a.string(),
        requiredHours: a.integer(),
        maxDailyHours: a.integer(),
        preferTwoHourBlocks: a.boolean(),
        penalizeSingleHourBlocks: a.boolean(),
        penalizeLongBlocks: a.boolean(),
      })
      .returns(a.string())
      .handler(a.handler.function(branchAndBound))
      .authorization(allow => [allow.publicApiKey()]),

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

    Lectures: a
      .model({
        courseId: a.string(),
        lectureId: a.string(),
        title: a.string(),
        content: a.string(),
        summary: a.string(),
        difficulty: a.string(),
        duration: a.string(),
        start_date: a.string(),
        end_date: a.string(),
        location: a.string(),
        type: a.string(),
      })
      .authorization(allow => [allow.publicApiKey()]),
      
    PersonalLearning: a
      .model({
        userId: a.string().required(),
        subject: a.string().required(),
        totalRequiredHours: a.integer().required(),
        weeklyDedicationHours: a.integer().required(),
        isActive: a.boolean().required().default(true),
      })
      .authorization(allow => [allow.publicApiKey()]),
      
    StudyPreference: a
      .model({
        studyTime: a.string(),
        maxHoursPerDay: a.integer(),
        lunchBreakStart: a.string(),
        lunchBreakDuration: a.integer(),
        studyDuringWork: a.boolean(),
        preferredTimeOfDay: a.enum(['MORNING', 'AFTERNOON', 'EVENING', 'CIRCADIAN', 'PERSONALIZE']),
        personalizedVector: a.string(),
        owner: a.string(),
        courses: a.string().array()
      })
      .authorization(allow => [allow.publicApiKey()]),

    AcceptedStudySession: a
      .model({
        day: a.string(),
        startTime: a.string(),
        endTime: a.string(),
        course: a.string(),
        startDate: a.string(),
        endDate: a.string(),
        userId: a.string(),
        weekStartDate: a.string(),
        title: a.string(),
        description: a.string(),
        type: a.enum(['STUDY']),
      })
      .authorization(allow => [allow.publicApiKey()]),

    AcceptedPersonalLearningSession: a
      .model({
        day: a.string(),
        startTime: a.string(),
        endTime: a.string(),
        subject: a.string(),
        startDate: a.string(),
        endDate: a.string(),
        userId: a.string(),
        weekStartDate: a.string(),
        title: a.string(),
        description: a.string(),
        type: a.enum(['LEARNING']),
      })
      .authorization(allow => [allow.publicApiKey()]),

    UserProgress: a
      .model({
        userId: a.string().required(),
        courseId: a.string().required(),
        lectureId: a.string().required(),
        completedLectures: a.string().array(),
        quizScores: a.integer(), 
        lastAccessed: a.string().required(),
      })
      .authorization(allow => [allow.publicApiKey()]),

    ScheduledReviews: a
      .model({
        userId: a.string().required(),
        courseId: a.string().required(),
        lectureId: a.string().required(),
        reviewDate: a.string().required(),
        halfLife: a.float().required(),
        lastScore: a.integer().required(),
        lastReviewDate: a.string().required(),
        studyCount: a.integer()
      })
      .authorization(allow => [allow.publicApiKey()]),

    FocusCoefficient: a
      .model({
        userId: a.string().required(),
        focusVector: a.string().required(), // Will store a vector of 105 values as a string
        lastUpdated: a.string(), // Optional timestamp of when the vector was last updated
        useFocusCoefficient: a.boolean().default(true) // Flag to enable/disable focus coefficient usage
      })
      .authorization(allow => [allow.publicApiKey()]),

  })
  .authorization(allow => [
    allow.resource(store_events),
    allow.resource(store_lectures),
  ])

  ;

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
  },
});