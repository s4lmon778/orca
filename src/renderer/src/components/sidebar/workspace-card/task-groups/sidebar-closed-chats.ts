import { useMemo } from 'react'
import { useAppStore } from '@/store/index'
import type { AppState } from '@/store/types'
import { selectWorkspaceAgentTaskGroups } from '@/store/slices/ui/agent-task-group-source'
import { openDesktopStructuredSession } from '@/lib/agent-session/open/activate-ai-vault-structured-session'
import { structuredAgentSessionAddressTabId } from '../../../../../../shared/agent-session/view/structured-agent-session-projection'
import type { WorkspaceAgentTaskGroups } from '../../../../../../shared/agent-task-groups/agent-task-groups'
import type { SidebarClosedChat } from '../../../../../../shared/agent-task-groups/sidebar-closed-chat-record'
import type { ExecutionHostId } from '../../../../../../shared/execution-host/execution-host'

const NO_CLOSED_CHATS: readonly SidebarClosedChat[] = []

/** Sessions open in a chat tab of this workspace, joined so the selection stays a stable string. */
function openChatSessionIds(state: AppState, worktreeId: string): string {
  return (state.unifiedTabsByWorktree[worktreeId] ?? [])
    .flatMap((tab) => (tab.contentType === 'agent-session' && tab.entityId ? [tab.entityId] : []))
    .join('\n')
}

/** Closed chats still listed in the sidebar; one open again in a tab shows as its live row instead. */
export function useSidebarClosedChats(
  worktreeId: string,
  executionHostId: ExecutionHostId | undefined
): readonly SidebarClosedChat[] {
  const closedChats = useAppStore(
    (s) => selectWorkspaceAgentTaskGroups(s, worktreeId, executionHostId)?.closedChats
  )
  const openSessionIds = useAppStore((s) => (closedChats ? openChatSessionIds(s, worktreeId) : ''))
  return useMemo(() => {
    if (!closedChats || closedChats.length === 0) {
      return NO_CLOSED_CHATS
    }
    const open = new Set(openSessionIds.split('\n'))
    const shown = closedChats.filter((chat) => !open.has(chat.sessionId))
    return shown.length > 0 ? shown : NO_CLOSED_CHATS
  }, [closedChats, openSessionIds])
}

/** The task group a closed chat's row sits in: the one its live row was shown under. */
export function closedChatGroupId(
  record: WorkspaceAgentTaskGroups,
  chat: SidebarClosedChat
): string | null {
  return record.groupIdByTabId[chat.rowTabId] ?? null
}

const reopening = new Set<string>()

/**
 * Reopens a closed chat from its host's history. Its row leaves the dimmed list once the chat is
 * open again, keeping its task group; a chat its host no longer has is dropped from the sidebar.
 */
export async function reopenSidebarClosedChat(args: {
  chat: SidebarClosedChat
  worktreeId: string
  workspaceKey: string
  groupId: string | null
}): Promise<void> {
  const { chat, worktreeId, workspaceKey, groupId } = args
  if (reopening.has(chat.sessionId)) {
    return
  }
  reopening.add(chat.sessionId)
  try {
    const result = await openDesktopStructuredSession({
      kind: 'history',
      structuredSession: { sessionId: chat.sessionId, workspaceId: worktreeId },
      ...(chat.agent ? { agent: chat.agent } : {})
    })
    const store = useAppStore.getState()
    if (result.kind === 'opened') {
      const rowTabId = structuredAgentSessionAddressTabId(result.tab.id, chat.sessionId)
      if (groupId && rowTabId !== chat.rowTabId) {
        store.assignTabToAgentTaskGroup(workspaceKey, rowTabId, groupId)
      }
      store.forgetSidebarClosedChat(workspaceKey, chat.sessionId)
    } else if (
      result.kind === 'failed' &&
      (result.failure.reason === 'gone' || result.failure.reason === 'workspace-missing')
    ) {
      store.forgetSidebarClosedChat(workspaceKey, chat.sessionId)
    }
  } finally {
    reopening.delete(chat.sessionId)
  }
}
