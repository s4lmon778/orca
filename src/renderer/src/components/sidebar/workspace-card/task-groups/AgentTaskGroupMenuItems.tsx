import React from 'react'
import { Check, EyeOff, FolderPlus, Layers, X } from 'lucide-react'
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from '@/components/ui/dropdown-menu'
import { useAppStore } from '@/store/index'
import { selectWorkspaceAgentTaskGroups } from '@/store/slices/ui/agent-task-group-source'
import { useTranslate } from '@/i18n/use-translate'
import type { ExecutionHostId } from '../../../../../../shared/execution-host/execution-host'
import {
  agentTaskGroupWorkspaceKey,
  canBrowseTaskGroupFolder
} from './agent-task-group-workspace-key'

/** Workspace menu entries: create a task group, or file the right-clicked conversation into one. */
export function AgentTaskGroupMenuItems({
  worktreeId,
  executionHostId,
  agentTabId,
  closedChatSessionId = null,
  disabled
}: {
  worktreeId: string
  executionHostId: ExecutionHostId | undefined
  /** The conversation whose agent row was right-clicked, if any. */
  agentTabId: string | null
  /** Set when the right-clicked row is a closed chat, which can be taken out of the sidebar. */
  closedChatSessionId?: string | null
  disabled?: boolean
}): React.JSX.Element {
  const t = useTranslate()
  const workspaceKey = agentTaskGroupWorkspaceKey(worktreeId, executionHostId)
  const taskGroups = useAppStore((s) =>
    selectWorkspaceAgentTaskGroups(s, worktreeId, executionHostId)
  )
  const openModal = useAppStore((s) => s.openModal)
  const assign = useAppStore((s) => s.assignTabToAgentTaskGroup)
  const forgetClosedChat = useAppStore((s) => s.forgetSidebarClosedChat)
  const dialogData = {
    workspaceKey,
    worktreeId,
    canBrowse: canBrowseTaskGroupFolder(executionHostId)
  }
  const newGroupLabel = t(
    'auto.components.sidebar.AgentTaskGroupMenuItems.newGroup',
    'New Task Group…'
  )

  if (!agentTabId) {
    return (
      <DropdownMenuItem
        disabled={disabled}
        onSelect={() => openModal('agent-task-group', dialogData)}
      >
        <FolderPlus className="size-3.5" />
        {newGroupLabel}
      </DropdownMenuItem>
    )
  }
  const currentGroupId = taskGroups?.groupIdByTabId[agentTabId] ?? null
  const groups = taskGroups?.groups ?? []
  const removeClosedChat = closedChatSessionId ? (
    <DropdownMenuItem
      disabled={disabled}
      onSelect={() => forgetClosedChat(workspaceKey, closedChatSessionId)}
    >
      <EyeOff className="size-3.5" />
      {t(
        'auto.components.sidebar.AgentTaskGroupMenuItems.removeFromSidebar',
        'Remove from Sidebar'
      )}
    </DropdownMenuItem>
  ) : null
  return (
    <>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger disabled={disabled}>
          <Layers className="size-3.5" />
          {t('auto.components.sidebar.AgentTaskGroupMenuItems.moveTo', 'Move to Task Group')}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="min-w-44">
          {groups.map((group) => (
            <DropdownMenuItem
              key={group.id}
              onSelect={() => assign(workspaceKey, agentTabId, group.id)}
            >
              {currentGroupId === group.id ? (
                <Check className="size-3.5" />
              ) : (
                <span aria-hidden className="size-3.5" />
              )}
              <span className="truncate">{group.name}</span>
            </DropdownMenuItem>
          ))}
          {currentGroupId ? (
            <DropdownMenuItem onSelect={() => assign(workspaceKey, agentTabId, null)}>
              <X className="size-3.5" />
              {t('auto.components.sidebar.AgentTaskGroupMenuItems.ungroup', 'Remove from Group')}
            </DropdownMenuItem>
          ) : null}
          {groups.length > 0 ? <DropdownMenuSeparator /> : null}
          <DropdownMenuItem
            onSelect={() =>
              openModal('agent-task-group', { ...dialogData, assignTabId: agentTabId })
            }
          >
            <FolderPlus className="size-3.5" />
            {newGroupLabel}
          </DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      {removeClosedChat}
    </>
  )
}
