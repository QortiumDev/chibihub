import { describe, expect, it } from 'vitest';
import { getChatRoomStatus, getComposerNote, getSendButtonLabel } from './ChatPage';
import type { ChatGroupSummary } from './chatData';

function makeGroup(overrides: Partial<ChatGroupSummary> = {}): ChatGroupSummary {
  return {
    groupId: 1,
    groupName: 'Test Group',
    isOpen: true,
    lastMessagePreview: 'hello',
    senderLabel: 'Someone',
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('getChatRoomStatus', () => {
  it('prompts to pick a group when none is selected', () => {
    expect(getChatRoomStatus({ selectedGroup: null, sendActionAvailable: true })).toEqual({
      detail: 'Pick a group to read messages.',
      label: 'Select a group',
    });
  });

  it('flags private groups as read-only regardless of send capability', () => {
    const status = getChatRoomStatus({
      selectedGroup: makeGroup({ isOpen: false }),
      sendActionAvailable: true,
    });

    expect(status.label).toBe('Private · Read-only');
  });

  it('flags unverified group privacy as read-only', () => {
    const status = getChatRoomStatus({
      selectedGroup: makeGroup({ isOpen: null }),
      sendActionAvailable: true,
    });

    expect(status.label).toBe('Privacy unknown · Read-only');
  });

  it('reports send-ready for public groups when Home supports sending', () => {
    const status = getChatRoomStatus({
      selectedGroup: makeGroup({ isOpen: true }),
      sendActionAvailable: true,
    });

    expect(status.label).toBe('Send-ready');
  });

  it('reports read-only for public groups when Home cannot send', () => {
    const status = getChatRoomStatus({
      selectedGroup: makeGroup({ isOpen: true }),
      sendActionAvailable: false,
    });

    expect(status.label).toBe('Read-only');
  });

  it('keeps a full-sentence detail available for every state', () => {
    const states = [
      getChatRoomStatus({ selectedGroup: null, sendActionAvailable: true }),
      getChatRoomStatus({ selectedGroup: makeGroup({ isOpen: false }), sendActionAvailable: true }),
      getChatRoomStatus({ selectedGroup: makeGroup({ isOpen: null }), sendActionAvailable: true }),
      getChatRoomStatus({ selectedGroup: makeGroup({ isOpen: true }), sendActionAvailable: true }),
      getChatRoomStatus({ selectedGroup: makeGroup({ isOpen: true }), sendActionAvailable: false }),
    ];

    for (const state of states) {
      expect(state.detail.length).toBeGreaterThan(0);
    }
  });
});

describe('getComposerNote', () => {
  it('leads with the outdated-Home warning even when a group is selected', () => {
    const note = getComposerNote({ selectedGroupIsOpen: true, sendActionAvailable: false, sendStatus: '' });

    expect(note).toEqual({
      isStatus: false,
      text: 'Home build too old: missing SEND_QORTAL_GROUP_CHAT.',
    });
  });

  it('explains why private group sending stays disabled', () => {
    const note = getComposerNote({ selectedGroupIsOpen: false, sendActionAvailable: true, sendStatus: '' });

    expect(note?.text).toContain('Private Qortal group sending stays disabled');
  });

  it('explains unverified privacy blocks sending', () => {
    const note = getComposerNote({ selectedGroupIsOpen: null, sendActionAvailable: true, sendStatus: '' });

    expect(note?.text).toContain("cannot verify this group's privacy");
  });

  it('surfaces the live send status as an aria-status note', () => {
    const note = getComposerNote({
      selectedGroupIsOpen: true,
      sendActionAvailable: true,
      sendStatus: 'Broadcast accepted: abc123',
    });

    expect(note).toEqual({ isStatus: true, text: 'Broadcast accepted: abc123' });
  });

  it('does not add helper copy when the composer is ready to send', () => {
    const note = getComposerNote({ selectedGroupIsOpen: true, sendActionAvailable: true, sendStatus: '' });

    expect(note).toBeNull();
  });
});

describe('getSendButtonLabel', () => {
  it('tracks whether Qubino is currently processing the message', () => {
    expect(getSendButtonLabel(false)).toBe('Send');
    expect(getSendButtonLabel(true)).toBe('Sending…');
  });
});
