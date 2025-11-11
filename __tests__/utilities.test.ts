import { jest } from '@jest/globals';

// Mock the @actions/core module before importing anything else
const mockSetFailed = jest.fn();
jest.unstable_mockModule('@actions/core', () => ({
  setFailed: mockSetFailed
}));

// Import after mocking
const { setFailedAndCreateError } = await import('../src/utilities.ts');

describe('utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('setFailedAndCreateError', () => {
    test('should call core.setFailed with the provided message', () => {
      const message = 'Test error message';

      setFailedAndCreateError(message);

      expect(mockSetFailed).toHaveBeenCalledWith(message);
      expect(mockSetFailed).toHaveBeenCalledTimes(1);
    });

    test('should return an Error object with the provided message', () => {
      const message = 'Test error message';

      const result = setFailedAndCreateError(message);

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe(message);
    });

    test('should handle empty string message', () => {
      const message = '';

      const result = setFailedAndCreateError(message);

      expect(mockSetFailed).toHaveBeenCalledWith(message);
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe(message);
    });

    test('should handle multiline message', () => {
      const message = 'Line 1\nLine 2\nLine 3';

      const result = setFailedAndCreateError(message);

      expect(mockSetFailed).toHaveBeenCalledWith(message);
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe(message);
    });

    test('should handle message with special characters', () => {
      const message = 'Error: Invalid input "test@example.com" with symbols & characters!';

      const result = setFailedAndCreateError(message);

      expect(mockSetFailed).toHaveBeenCalledWith(message);
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe(message);
    });
  });
});
