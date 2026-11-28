import { describe, expect, it } from 'vitest'
import {
  assignTabToAgentTaskGroup,
  createAgentTaskGroup,
  deleteAgentTaskGroup,
  normalizeAgentTaskGroupsByWorkspace,
  normalizeWorkspaceAgentTaskGroups,
  type AgentTaskGroupsByWorkspace
} from './agent-task-groups'
import {
  forgetSidebarClosedChat,
  MAX_SIDEBAR_CLOSED_CHATS_PER_WORKSPACE,
  rememberSidebarClosedChat,
  type SidebarClosedChat
} from './sidebar-closed-chats'

const WS = 'local\u0000wt-1'

function chat(sessionId: string, overrides: Partial<SidebarClosedChat> = {}): SidebarClosedChat {
  return {
    sessionId,
    rowTabId: `tab-${sessionId}`,
    title: `Chat ${sessionId}`,
    agent: 'claude',
    startedAt: 10,
    closedAt: 20,
    ...overrides
  }
}

describe('sidebar closed chats', () => {
  it('keeps a workspace with only closed chats and survives a persisted round trip', () => {
    const state = rememberSidebarClosedChat({}, WS, chat('s1'))
    expect(state[WS]).toEqual({ groups: [], groupIdByTabId: {}, closedChats: [chat('s1')] })
    const persisted: unknown = JSON.parse(JSON.stringify(state))
    expect(normalizeAgentTaskGroupsByWorkspace(persisted)).toEqual(state)
  })

  it('lists a conversation once, moving a re-closed one to the newest end', () => {
    let state = rememberSidebarClosedChat({}, WS, chat('s1'))
    state = rememberSidebarClosedChat(state, WS, chat('s2'))
    state = rememberSidebarClosedChat(state, WS, chat('s1', { title: 'Renamed', closedAt: 30 }))
    expect(state[WS].closedChats?.map((entry) => [entry.sessionId, entry.title])).toEqual([
      ['s2', 'Chat s2'],
      ['s1', 'Renamed']
    ])
  })

  it('keeps only the most recently closed chats', () => {
    let state: AgentTaskGroupsByWorkspace = {}
    for (let index = 0; index <= MAX_SIDEBAR_CLOSED_CHATS_PER_WORKSPACE; index++) {
      state = rememberSidebarClosedChat(state, WS, chat(`s${index}`))
    }
    const closed = normalizeWorkspaceAgentTaskGroups(state[WS])?.closedChats
    expect(closed).toHaveLength(MAX_SIDEBAR_CLOSED_CHATS_PER_WORKSPACE)
    expect(closed?.[0].sessionId).toBe('s1')
  })

  it('drops the workspace record once its last closed chat is removed and it has no groups', () => {
    const state = rememberSidebarClosedChat({}, WS, chat('s1'))
    expect(forgetSidebarClosedChat(state, WS, 's1')).toEqual({})
    expect(forgetSidebarClosedChat(state, WS, 'missing')).toBe(state)
  })

  it('leaves groups and memberships alone when a closed chat is removed', () => {
    let state = createAgentTaskGroup({}, WS, { id: 'g1', name: 'PA4', createdAt: 1 })
    state = assignTabToAgentTaskGroup(state, WS, 'tab-s1', 'g1')
    state = rememberSidebarClosedChat(state, WS, chat('s1'))
    state = forgetSidebarClosedChat(state, WS, 's1')
    expect(state[WS]).toEqual({
      groups: [{ id: 'g1', name: 'PA4', createdAt: 1 }],
      groupIdByTabId: { 'tab-s1': 'g1' }
    })
  })

  it('keeps closed chats when the workspace loses its last group', () => {
    let state = createAgentTaskGroup({}, WS, { id: 'g1', name: 'PA4', createdAt: 1 })
    state = rememberSidebarClosedChat(state, WS, chat('s1'))
    state = deleteAgentTaskGroup(state, WS, 'g1')
    expect(state[WS]?.closedChats?.map((entry) => entry.sessionId)).toEqual(['s1'])
  })

  it('rejects malformed persisted entries without losing valid ones', () => {
    const normalized = normalizeWorkspaceAgentTaskGroups({
      closedChats: [
        { sessionId: '', rowTabId: 'x', title: 'no id' },
        { sessionId: 's1', title: 'no row' },
        { sessionId: 's2', rowTabId: 'tab-s2', title: '  spaced   title ', startedAt: 'soon' },
        'junk'
      ]
    })
    expect(normalized).toEqual({
      groups: [],
      groupIdByTabId: {},
      closedChats: [
        { sessionId: 's2', rowTabId: 'tab-s2', title: 'spaced title', startedAt: 0, closedAt: 0 }
      ]
    })
  })
})
