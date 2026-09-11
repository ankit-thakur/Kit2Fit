module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/shared', '<rootDir>/backend'],
  testPathIgnorePatterns: ['/node_modules/', '/cdk.out/'],
  // tsconfig `paths` covers typechecking; jest needs the alias for runtime
  // resolution too, or every v2 handler test fails to load.
  moduleNameMapper: { '^@shared/(.*)$': '<rootDir>/shared/$1' },
};
