const axios = require('axios');
const { discoverCompanies } = require('../../src/services/discoveryService');

// Mock axios and the logger so we don't trigger real HTTP requests or console spam
jest.mock('axios');
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('discoverCompanies - Data Cleaning Pipeline', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    // Set a dummy API key to bypass the fail-fast check
    process.env = { ...originalEnv, APOLLO_API_KEY: 'test-api-key' };
  });

  afterAll(() => {
    // Restore original environment variables after testing
    process.env = originalEnv;
  });

  it('should return a clean, deduplicated list of domains and ignore empty or null values', async () => {
    // 1. Arrange: Create a "dirty" mock response from Apollo
    const mockDirtyData = {
      organizations: [
        { primary_domain: 'competitor1.com' },
        { primary_domain: 'competitor1.com' }, // Duplicate
        { primary_domain: null },              // Null value
        { primary_domain: '' },                // Empty string
        { primary_domain: '   ' },             // Whitespace string
        { },                                   // Missing primary_domain entirely
        { primary_domain: 'competitor2.com' }
      ]
    };

    axios.post.mockResolvedValueOnce({
      status: 200,
      data: mockDirtyData,
    });

    // 2. Act: Call the service
    const results = await discoverCompanies('stripe.com');

    // 3. Assert: Verify the cleaning pipeline worked
    expect(results).toEqual(['competitor1.com', 'competitor2.com']);
    expect(axios.post).toHaveBeenCalledTimes(1);
  });
});