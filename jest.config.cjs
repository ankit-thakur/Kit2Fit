module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/shared', '<rootDir>/backend'],
  testPathIgnorePatterns: ['/node_modules/', '/cdk.out/'],
};
