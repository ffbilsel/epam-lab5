/** @type {import('jest').Config} */
const tsJestPreset = {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: '<rootDir>/tsconfig.test.json',
      },
    ],
  },
};

module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  collectCoverageFrom: ['src/**/*.ts', '!src/server.ts', '!src/app.ts', '!src/infra/**'],
  coverageThreshold: {
    'src/domain/**/*.ts': { lines: 80, branches: 80, functions: 80, statements: 80 },
    'src/services/**/*.ts': { lines: 80, branches: 80, functions: 80, statements: 80 },
  },
  projects: [
    {
      ...tsJestPreset,
      displayName: 'unit',
      testMatch: ['<rootDir>/tests/unit/**/*.test.ts'],
    },
    {
      ...tsJestPreset,
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
      testTimeout: 60000,
    },
    {
      ...tsJestPreset,
      displayName: 'e2e',
      testMatch: ['<rootDir>/tests/e2e/**/*.test.ts'],
      testTimeout: 60000,
    },
  ],
};
