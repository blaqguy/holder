/* eslint-disable */
export default {
  displayName: 'stacks',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/libs/stacks',
  setupFilesAfterEnv: ['../../jest.setup.ts'],
};
