/* eslint-disable */
export default {
  displayName: 'generated',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/libs/generated',
  setupFilesAfterEnv: ['../../jest.setup.ts'],
};
