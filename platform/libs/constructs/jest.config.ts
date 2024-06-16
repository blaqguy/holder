/* eslint-disable */
export default {
  displayName: 'constructs',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/libs/constructs',
  setupFilesAfterEnv: ['../../jest.setup.ts'],
};
