/* eslint-disable */
export default {
  displayName: 'components',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/libs/components',
  setupFilesAfterEnv: ['../../jest.setup.ts'],
};
