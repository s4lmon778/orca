import React, { useCallback, useEffect, useMemo } from 'react'
import { useAppStore } from '@/store/index'
import { selectWorkspaceAgentTaskGroups } from '@/store/slices/ui/agent-task-group-source'
import { moveDeviceAgentTaskGroupsToHosts } from '@/store/slices/ui/agent-task-group-host-move'
import { useAgentPresentation } from '../activity/useWorktreeAgentRows'
import type { WorkspaceAgentTaskGroups } from '../../../../../../shared/agent-task-groups/agent-task-groups'
import type { SidebarClosedChat } from '../../../../../../shared/agent-task-groups/sidebar-closed-chat-record'
import type { ExecutionHostId } from '../../../../../../shared/execution-host/execution-host'
import { agentTaskGroupWorkspaceKey } from './agent-task-group-workspace-key'

export { AGENT_ROW_TAB_ID_ATTR } from './agent-task-group-workspace-key'
import { AgentTaskGroupSection } from './AgentTaskGroupSection'
import { SidebarClosedChatRow } from './SidebarClosedChatRow'
import { closedChatGroupId, useSidebarClosedChats } from './sidebar-closed-chats'

type LiveRoot = { key: string; startedAt: number }
type GroupItem =
  | { kind: 'live'; keys: string[] }
  | { kind: 'closed'; chat: SidebarClosedChat; groupId: string | null }
type GroupSection = { items: GroupItem[]; count: number }
type GroupedRoots = { ungrouped: GroupSection; byGroup: Map<string, GroupSection> }
type BranchesComponent<Context> = React.ComponentType<{
  keysToRender: readonly string[]
  context: Context
  timerActive: boolean
  root?: boolean
}>

const EMPTY_SECTION: GroupSection = { items: [], count: 0 }

/** `folded` hides the card's whole conversation list behind its title chevron. */
export function useAgentTaskGroupsList(
  worktreeId: string,
  executionHostId: ExecutionHostId | undefined
): 'none' | 'open' | 'folded' {
  // Cards mount once workspaces are listed: the first moment this device's older groups can move.
  useEffect(() => moveDeviceAgentTaskGroupsToHosts(useAppStore), [])
  return useAppStore((s) => {
    const record = selectWorkspaceAgentTaskGroups(s, worktreeId, executionHostId)
    if (!record || record.groups.length === 0) {
      return 'none'
    }
    return record.listCollapsed ? 'folded' : 'open'
  })
}

/** A folded card hides its conversations; one with task groups or closed chats shows them even before any agent runs. */
export function useShowsAgentList(
  worktreeId: string,
  executionHostId: ExecutionHostId | undefined,
  hasRoots: boolean
): boolean {
  const list = useAgentTaskGroupsList(worktreeId, executionHostId)
  const closedChats = useSidebarClosedChats(worktreeId, executionHostId)
  return list === 'open' || (list === 'none' && (hasRoots || closedChats.length > 0))
}

/** Root rows split by their conversation's task group, closed chats in their old places; null keeps the ungrouped card layout. */
export function useTaskGroupedRoots(
  worktreeId: string,
  executionHostId: ExecutionHostId | undefined,
  roots: readonly string[]
): { groups: WorkspaceAgentTaskGroups; grouped: GroupedRoots } | null {
  const taskGroups = useAppStore((s) =>
    selectWorkspaceAgentTaskGroups(s, worktreeId, executionHostId)
  )
  const closedChats = useSidebarClosedChats(worktreeId, executionHostId)
  // A pane's tab never changes, so the roots channel covers it; the joined string keeps snapshots stable.
  const rootFacts = useAgentPresentation(
    `roots\0${worktreeId}`,
    useCallback(
      (p) =>
        roots
          .map((key) => {
            const row = p.row(key)
            return `${row?.tab.id ?? ''}\t${row?.startedAt ?? 0}`
          })
          .join('\n'),
      [roots]
    )
  )
  return useMemo(() => {
    if (!taskGroups || (taskGroups.groups.length === 0 && closedChats.length === 0)) {
      return null
    }
    const facts = rootFacts.split('\n').map((line) => {
      const [tabId = '', startedAt = '0'] = line.split('\t')
      return { tabId, startedAt: Number(startedAt) || 0 }
    })
    const live = new Map<string, LiveRoot[]>(taskGroups.groups.map((group) => [group.id, []]))
    const ungroupedLive: LiveRoot[] = []
    roots.forEach((key, index) => {
      const fact = facts[index]
      const groupId = taskGroups.groupIdByTabId[fact?.tabId ?? '']
      ;((groupId ? live.get(groupId) : undefined) ?? ungroupedLive).push({
        key,
        startedAt: fact?.startedAt ?? 0
      })
    })
    const closed = new Map<string, SidebarClosedChat[]>()
    const ungroupedClosed: SidebarClosedChat[] = []
    for (const chat of closedChats) {
      const groupId = closedChatGroupId(taskGroups, chat)
      if (groupId && live.has(groupId)) {
        closed.set(groupId, [...(closed.get(groupId) ?? []), chat])
      } else {
        ungroupedClosed.push(chat)
      }
    }
    const byGroup = new Map<string, GroupSection>()
    for (const group of taskGroups.groups) {
      byGroup.set(
        group.id,
        mergeSection(live.get(group.id) ?? [], closed.get(group.id) ?? [], group.id)
      )
    }
    return {
      groups: taskGroups,
      grouped: { ungrouped: mergeSection(ungroupedLive, ungroupedClosed, null), byGroup }
    }
  }, [closedChats, rootFacts, roots, taskGroups])
}

/** Closed chats slot in among live rows by when each conversation started, as their rows stood. */
function mergeSection(
  live: readonly LiveRoot[],
  closed: readonly SidebarClosedChat[],
  groupId: string | null
): GroupSection {
  const pending = [...closed].sort((a, b) => a.startedAt - b.startedAt)
  const items: GroupItem[] = []
  const pushLive = (key: string): void => {
    const last = items.at(-1)
    if (last?.kind === 'live') {
      last.keys.push(key)
    } else {
      items.push({ kind: 'live', keys: [key] })
    }
  }
  let next = 0
  for (const root of live) {
    for (; next < pending.length && pending[next].startedAt < root.startedAt; next++) {
      items.push({ kind: 'closed', chat: pending[next], groupId })
    }
    pushLive(root.key)
  }
  for (const chat of pending.slice(next)) {
    items.push({ kind: 'closed', chat, groupId })
  }
  return { items, count: live.length + closed.length }
}

/** Ungrouped conversations keep their usual place; each task group follows as a foldable section. */
export function TaskGroupedAgentList<Context>({
  worktreeId,
  executionHostId,
  taskGroups,
  context,
  Branches
}: {
  worktreeId: string
  executionHostId: ExecutionHostId | undefined
  taskGroups: NonNullable<ReturnType<typeof useTaskGroupedRoots>>
  context: Context
  Branches: BranchesComponent<Context>
}): React.JSX.Element {
  const { groups, grouped } = taskGroups
  const workspaceKey = agentTaskGroupWorkspaceKey(worktreeId, executionHostId)
  const renderSection = (section: GroupSection, timerActive: boolean) =>
    section.items.map((item) =>
      item.kind === 'live' ? (
        <Branches
          key={`live:${item.keys[0]}`}
          keysToRender={item.keys}
          context={context}
          timerActive={timerActive}
          root
        />
      ) : (
        <SidebarClosedChatRow
          key={`closed:${item.chat.sessionId}`}
          chat={item.chat}
          worktreeId={worktreeId}
          workspaceKey={workspaceKey}
          groupId={item.groupId}
        />
      )
    )
  return (
    <>
      {/* Task groups lead; standalone conversations follow them. */}
      {groups.groups.map((group, index) => {
        const section = grouped.byGroup.get(group.id) ?? EMPTY_SECTION
        return (
          <AgentTaskGroupSection
            key={group.id}
            group={group}
            index={index}
            groupCount={groups.groups.length}
            workspaceKey={workspaceKey}
            worktreeId={worktreeId}
            executionHostId={executionHostId}
            conversationCount={section.count}
          >
            {renderSection(section, !group.collapsed)}
          </AgentTaskGroupSection>
        )
      })}
      {grouped.ungrouped.items.length > 0 ? renderSection(grouped.ungrouped, true) : null}
    </>
  )
}
