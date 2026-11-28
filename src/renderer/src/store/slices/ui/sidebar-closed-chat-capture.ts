import type { AppState } from '@/store/types'
import { findFirstIndexedWorktree } from '@/lib/workspace/ownership/worktree-runtime-owner-index'
import { selectWorktreesByRepo } from '@/store/workspaces/catalog/workspace-record-fields'
import { readStructuredChatTabName } from '@/runtime/native-chat/naming/structured-chat-tab-name'
import { agentTaskGroupWorkspaceKey } from '@/components/sidebar/workspace-card/task-groups/agent-task-group-workspace-key'
import {
  structuredAgentSessionAddressTabId,
  structuredAgentSessionPaneKey
} from '../../../../../shared/agent-session/view/structured-agent-session-projection'
import type { Tab } from '../../../../../shared/workspace-layout/tab-groups/tab-types'

/**
 * A chat the user closes stays in the sidebar, dimmed where its row was, so it can be reopened
 * with one click. Read before the tab goes, while its row and name still exist.
 */
export function rememberClosedChatTab(state: AppState, worktreeId: string, tab: Tab): void {
  if (tab.contentType !== 'agent-session' || !tab.entityId) {
    return
  }
  const sessionId = tab.entityId
  const executionHostId = findFirstIndexedWorktree(
    selectWorktreesByRepo(state) ?? {},
    worktreeId
  )?.hostId
  const row = state.agentStatusByPaneKey.projection.row(
    structuredAgentSessionPaneKey(tab.id, sessionId)
  )
  const startedAt = row && row.startedAt > 0 ? row.startedAt : tab.createdAt
  state.rememberSidebarClosedChat(agentTaskGroupWorkspaceKey(worktreeId, executionHostId), {
    sessionId,
    rowTabId: row?.tab.id ?? structuredAgentSessionAddressTabId(tab.id, sessionId),
    title: readStructuredChatTabName(tab, state),
    ...(tab.agentSessionAgent ? { agent: tab.agentSessionAgent } : {}),
    startedAt,
    closedAt: Date.now()
  })
}
