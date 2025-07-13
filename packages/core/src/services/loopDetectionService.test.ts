/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LoopDetectionService } from './loopDetectionService.js';
import {
  GeminiEventType,
  ServerGeminiContentEvent,
  ServerGeminiToolCallRequestEvent,
} from '../core/turn.js';
import { ServerGeminiStreamEvent } from '../core/turn.js';

const TOOL_CALL_LOOP_THRESHOLD = 5;
const CONTENT_LOOP_THRESHOLD = 10;

describe('LoopDetectionService', () => {
  let service: LoopDetectionService;

  beforeEach(() => {
    service = new LoopDetectionService();
  });

  const createToolCallRequestEvent = (
    name: string,
    args: Record<string, unknown>,
  ): ServerGeminiToolCallRequestEvent => ({
    type: GeminiEventType.ToolCallRequest,
    value: {
      name,
      args,
      callId: 'test-id',
      isClientInitiated: false,
      prompt_id: 'test-prompt-id',
    },
  });

  const createContentEvent = (content: string): ServerGeminiContentEvent => ({
    type: GeminiEventType.Content,
    value: content,
  });

  describe('Tool Call Loop Detection', () => {
    it(`should not detect a loop for fewer than TOOL_CALL_LOOP_THRESHOLD identical calls`, () => {
      const event = createToolCallRequestEvent('testTool', { param: 'value' });
      for (let i = 0; i < TOOL_CALL_LOOP_THRESHOLD - 1; i++) {
        expect(service.addAndCheck(event)).toBe(false);
      }
    });

    it(`should detect a loop on the TOOL_CALL_LOOP_THRESHOLD-th identical call`, () => {
      const event = createToolCallRequestEvent('testTool', { param: 'value' });
      for (let i = 0; i < TOOL_CALL_LOOP_THRESHOLD - 1; i++) {
        service.addAndCheck(event);
      }
      expect(service.addAndCheck(event)).toBe(true);
    });

    it('should detect a loop on subsequent identical calls', () => {
      const event = createToolCallRequestEvent('testTool', { param: 'value' });
      for (let i = 0; i < TOOL_CALL_LOOP_THRESHOLD; i++) {
        service.addAndCheck(event);
      }
      expect(service.addAndCheck(event)).toBe(true);
    });

    it('should not detect a loop for different tool calls', () => {
      const event1 = createToolCallRequestEvent('testTool', {
        param: 'value1',
      });
      const event2 = createToolCallRequestEvent('testTool', {
        param: 'value2',
      });
      const event3 = createToolCallRequestEvent('anotherTool', {
        param: 'value1',
      });

      for (let i = 0; i < TOOL_CALL_LOOP_THRESHOLD - 2; i++) {
        expect(service.addAndCheck(event1)).toBe(false);
        expect(service.addAndCheck(event2)).toBe(false);
        expect(service.addAndCheck(event3)).toBe(false);
      }
    });

    it('should distinguish between tools with same name but different args', () => {
      const event1 = createToolCallRequestEvent('testTool', { param: 'A' });
      const event2 = createToolCallRequestEvent('testTool', { param: 'B' });
      for (let i = 0; i < TOOL_CALL_LOOP_THRESHOLD - 1; i++) {
        service.addAndCheck(event1);
      }
      expect(service.addAndCheck(event2)).toBe(false);
      expect(service.addAndCheck(event1)).toBe(true);
    });
  });

  describe('Content Loop Detection', () => {
    it(`should not detect a loop for fewer than CONTENT_LOOP_THRESHOLD identical content strings`, () => {
      const event = createContentEvent('This is a test sentence.');
      for (let i = 0; i < CONTENT_LOOP_THRESHOLD - 1; i++) {
        expect(service.addAndCheck(event)).toBe(false);
      }
    });

    it(`should detect a loop on the CONTENT_LOOP_THRESHOLD-th identical content string`, () => {
      const event = createContentEvent('This is a test sentence.');
      for (let i = 0; i < CONTENT_LOOP_THRESHOLD - 1; i++) {
        service.addAndCheck(event);
      }
      expect(service.addAndCheck(event)).toBe(true);
    });

    it('should not detect a loop for different content strings', () => {
      const event1 = createContentEvent('Sentence A');
      const event2 = createContentEvent('Sentence B');
      for (let i = 0; i < CONTENT_LOOP_THRESHOLD - 2; i++) {
        expect(service.addAndCheck(event1)).toBe(false);
        expect(service.addAndCheck(event2)).toBe(false);
      }
    });
  });

  describe('General Behavior', () => {
    it('should return false for unhandled event types', () => {
      const otherEvent = {
        type: 'unhandled_event',
      } as unknown as ServerGeminiStreamEvent;
      expect(service.addAndCheck(otherEvent)).toBe(false);
      expect(service.addAndCheck(otherEvent)).toBe(false);
    });
  });
});
