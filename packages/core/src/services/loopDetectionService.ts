/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createHash } from 'crypto';
import { GeminiEventType, ServerGeminiStreamEvent } from '../core/turn.js';

const TOOL_CALL_LOOP_THRESHOLD = 5;
const CONTENT_LOOP_THRESHOLD = 10;

export class LoopDetectionService {
  private toolCallCounts = new Map<string, number>();
  private accumulatedContent = '';

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

        if (newContent.trim() === '') {
          return false;
        }

        // Need to escape special characters for the regex.
        const escapedContent = newContent.replace(
          /[.*+?^${}()|[\]\\]/g,
          '\\$&',
        );
        const regex = new RegExp(escapedContent, 'g');
        const count = (this.accumulatedContent.match(regex) || []).length;
        return count >= CONTENT_LOOP_THRESHOLD;
      }
      default:
        return false;
    }
  }

  reset() {
    this.toolCallCounts.clear();
    this.accumulatedContent = '';
  }
}
