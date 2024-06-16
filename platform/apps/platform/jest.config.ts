/* eslint-disable */
export default {
  displayName: 'platform',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/platform',
  setupFilesAfterEnv: ['../../jest.setup.ts'],
};
