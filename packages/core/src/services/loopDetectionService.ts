/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createHash } from 'crypto';
import { GeminiEventType, ServerGeminiStreamEvent } from '../core/turn.js';

const TOOL_CALL_LOOP_THRESHOLD = 5;
const CONTENT_LOOP_THRESHOLD = 10;
const MAX_LOOPBACK_WINDOW = 1000;

export class LoopDetectionService {
  private toolCallCounts = new Map<string, number>();
  private accumulatedContent = '';
  private cachedSentences: string[] = [];
  private lastContentLength = 0;

  private getToolCallKey(toolCall: { name: string; args: object }): string {
    // Stringify args for a consistent key.
    const argsString = JSON.stringify(toolCall.args);
    const keyString = `${toolCall.name}:${argsString}`;
    return createHash('sha256').update(keyString).digest('hex');
  }

  addAndCheck(event: ServerGeminiStreamEvent): boolean {
    switch (event.type) {
      case GeminiEventType.ToolCallRequest: {
        const key = this.getToolCallKey(event.value);
        const count = (this.toolCallCounts.get(key) ?? 0) + 1;
        this.toolCallCounts.set(key, count);
        return count >= TOOL_CALL_LOOP_THRESHOLD;
      }
      case GeminiEventType.Content: {
        const newContent = event.value;
        this.accumulatedContent += newContent;

        // Limit the accumulated content length.
        if (this.accumulatedContent.length > MAX_LOOPBACK_WINDOW) {
          const trimLength =
            this.accumulatedContent.length - MAX_LOOPBACK_WINDOW;
          this.accumulatedContent = this.accumulatedContent.slice(trimLength);
          // Reset cache when content is trimmed
          this.cachedSentences = [];
          this.lastContentLength = 0;
        }

        // We only check for repetition when a sentence is likely to be complete,
        // which we detect by the presence of sentence-ending punctuation.
        if (!/[.!?]/.test(newContent)) {
          return false;
        }

        // Only re-extract sentences if content has grown significantly
        if (
          this.accumulatedContent.length - this.lastContentLength > 100 ||
          this.cachedSentences.length === 0
        ) {
          this.cachedSentences =
            this.accumulatedContent.match(/[^.!?]+[.!?]/g) || [];
          this.lastContentLength = this.accumulatedContent.length;
        }

        // Extract all sentences from accumulated content for counting
        const allSentences =
          this.accumulatedContent.match(/[^.!?]+[.!?]/g) || [];

        // We need at least two sentences to check for a loop.
        if (allSentences.length < 2) {
          return false;
        }

        const lastSentence = allSentences[allSentences.length - 1].trim();

        if (lastSentence === '') {
          return false;
        }
        let count = 0;
        for (const sentence of allSentences) {
          if (sentence.trim() === lastSentence) {
            count++;
            if (count >= CONTENT_LOOP_THRESHOLD) {
              return true;
            }
          }
        }

        return false;
      }
      default:
        return false;
    }
  }

  reset() {
    this.toolCallCounts.clear();
    this.accumulatedContent = '';
    this.cachedSentences = [];
    this.lastContentLength = 0;
  }
}
