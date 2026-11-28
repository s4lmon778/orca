import {
  MAX_AGENT_TASK_GROUP_WORKSPACES,
  updateWorkspaceAgentTaskGroups,
  type AgentTaskGroupsByWorkspace
} from './agent-task-groups'
import { normalizeSidebarClosedChats, type SidebarClosedChat } from './sidebar-closed-chat-record'

export {
  MAX_SIDEBAR_CLOSED_CHATS_PER_WORKSPACE,
  type SidebarClosedChat
} from './sidebar-closed-chat-record'

/** Keeps a closed chat in the sidebar; closing it again moves it to the newest end. */
export function rememberSidebarClosedChat(
  state: AgentTaskGroupsByWorkspace,
  workspaceKey: string,
  chat: SidebarClosedChat
): AgentTaskGroupsByWorkspace {
  const valid = normalizeSidebarClosedChats([chat]).length === 1
  if (
    !valid ||
    !workspaceKey ||
    (!state[workspaceKey] && Object.keys(state).length >= MAX_AGENT_TASK_GROUP_WORKSPACES)
  ) {
    return state
  }
  return updateWorkspaceAgentTaskGroups(state, workspaceKey, (current) => ({
    ...current,
    closedChats: normalizeSidebarClosedChats([...(current.closedChats ?? []), chat])
  }))
}

/** Takes a closed chat out of the sidebar; its conversation stays in session history. */
export function forgetSidebarClosedChat(
  state: AgentTaskGroupsByWorkspace,
  workspaceKey: string,
  sessionId: string
): AgentTaskGroupsByWorkspace {
  return updateWorkspaceAgentTaskGroups(state, workspaceKey, (current) => {
    const closedChats = current.closedChats ?? []
    if (!closedChats.some((chat) => chat.sessionId === sessionId)) {
      return current
    }
    const { closedChats: _omit, ...rest } = current
    const remaining = closedChats.filter((chat) => chat.sessionId !== sessionId)
    return remaining.length > 0 ? { ...rest, closedChats: remaining } : rest
  })
}
