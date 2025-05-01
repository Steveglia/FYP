```
├── amplify/                # AWS Amplify backend configuration
│   ├── auth/               # Authentication configuration
│   ├── data/               # Data models and schema
│   ├── functions/          # Lambda functions
│   │   ├── branchAndBound/            # Scheduling algorithm service
│   │   ├── generatePreferenceVector/  # Study preference service
│   │   ├── generateStudySessions/     # Study session generation
│   │   ├── storeEvents/               # Calendar event processor
│   │   └── storeLectures/             # Lecture data processor
│   ├── storage/            # S3 storage configuration
│   └── backend.ts          # Backend definition file
│
├── src/                    # Frontend React application
│   ├── components/         # Reusable UI components
│   │   ├── schedule/       # Schedule-related components
│   │   ├── CourseSelection.tsx        # Course selection interface
│   │   ├── Navigation.tsx             # Navigation bar component
│   │   ├── PersonalLearning.tsx       # Personal learning interface
│   │   └── WeeklySchedule.tsx         # Weekly schedule view
│   ├── pages/              # Page components
│   │   ├── FocusCoefficient.tsx       # Focus tracking interface
│   │   ├── Home.tsx                   # Homepage component
│   │   ├── Preferences.tsx            # User preferences page
│   │   ├── ReviewSessions.tsx         # Review sessions manager
│   │   └── Schedule.tsx               # Schedule view page
│   ├── scripts/            # Utility scripts
│   ├── graphql/            # GraphQL queries/mutations
│   ├── assets/             # Static assets
│   ├── App.tsx             # Main application component
│   └── main.tsx            # Application entry point
│
├── public/                 # Public static files
│
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── vite.config.ts          # Vite bundler configuration
└── README.md               # Project documentation

``` 