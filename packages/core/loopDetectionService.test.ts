import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LoopDetectionService } from './src/services/loopDetectionService';
import { GeminiEventType, ServerGeminiStreamEvent } from './src/core/turn';

vi.mock('crypto', () => ({
  createHash: vi.fn().mockReturnValue({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue('mocked_hash'),
  }),
}));

describe('LoopDetectionService', () => {
  let loopDetectionService: LoopDetectionService;

  beforeEach(() => {
    loopDetectionService = new LoopDetectionService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('addAndCheck', () => {
    it('should not detect a loop for content with no punctuation', () => {
      const event: ServerGeminiStreamEvent = {
        type: GeminiEventType.Content,
        value: 'abc',
      };
      expect(loopDetectionService.addAndCheck(event)).toBe(false);
    });

    it('should detect a loop for repeated sentences', () => {
      const events: ServerGeminiStreamEvent[] = [
        { type: GeminiEventType.Content, value: 'Hello world.' },
        { type: GeminiEventType.Content, value: 'Hello world.' },
        { type: GeminiEventType.Content, value: 'Hello world.' },
        { type: GeminiEventType.Content, value: 'Hello world.' },
        { type: GeminiEventType.Content, value: 'Hello world.' },
        { type: GeminiEventType.Content, value: 'Hello world.' },
        { type: GeminiEventType.Content, value: 'Hello world.' },
        { type: GeminiEventType.Content, value: 'Hello world.' },
        { type: GeminiEventType.Content, value: 'Hello world.' },
        { type: GeminiEventType.Content, value: 'Hello world.' },
      ];

      for (let i = 0; i < events.length - 1; i++) {
        expect(loopDetectionService.addAndCheck(events[i])).toBe(false);
      }
      expect(loopDetectionService.addAndCheck(events[events.length - 1])).toBe(
        true,
      );
    });

    it('should limit accumulatedContent to MAX_LOOPBACK_WINDOW', () => {
      const longString = 'a'.repeat(500);
      const events: ServerGeminiStreamEvent[] = [
        { type: GeminiEventType.Content, value: longString },
        { type: GeminiEventType.Content, value: 'b' },
      ];

      loopDetectionService.addAndCheck(events[0]);
      // @ts-ignore
      expect(loopDetectionService.accumulatedContent).toBe(longString);

      loopDetectionService.addAndCheck(events[1]);
      // @ts-ignore
      expect(loopDetectionService.accumulatedContent).toBe(
        longString.slice(1) + 'b',
      );
    });
  });
});
