import React, { useMemo, useEffect, useCallback, useState } from 'react'
import { usePage } from '../../../lib/stores/pageStore'
import { useNav } from '../../../lib/stores/nav'
import { useTitle } from 'react-use'
import { useModal } from '../../../lib/stores/modal'
import {
  useGlobalKeyDownHandler,
  preventKeyboardEventPropagation,
} from '../../../lib/keyboard'
import {
  isFolderBookmarkShortcut,
  isFolderDeleteShortcut,
  isFolderEditShortcut,
} from '../../../lib/shortcuts'
import EditFolderModal from '../Modal/contents/Folder/EditFolderModal'
import { SerializedDocWithBookmark } from '../../../interfaces/db/doc'
import {
  mdiFolderOutline,
  mdiTextBoxPlusOutline,
  mdiFolderMultiplePlusOutline,
  mdiStarOutline,
  mdiStar,
  mdiDotsHorizontal,
} from '@mdi/js'
import { SerializedFolderWithBookmark } from '../../../interfaces/db/folder'
import EmojiIcon from '../../atoms/EmojiIcon'
import ContentManager from '../../molecules/ContentManager'
import { useEmojiPicker } from '../../../lib/stores/emoji'
import { EmojiResource } from '../Sidebar/SideNavigator/SideNavIcon'
import SingleInputModal from '../Modal/contents/Forms/SingleInputModal'
import RightLayoutHeaderButtons from '../../molecules/RightLayoutHeaderButtons'
import { SerializedWorkspace } from '../../../interfaces/db/workspace'
import Application from '../../Application'
import ErrorLayout from '../../../../components/v2/templates/ErrorLayout'
import { useCloudUpdater } from '../../../../lib/v2/hooks/cloud/useCloudUpdater'
import { mapTopbarBreadcrumbs } from '../../../../lib/v2/mappers/cloud/topbarBreadcrumbs'
import { useRouter } from '../../../lib/router'
import { LoadingButton } from '../../../../components/v2/atoms/Button'
import FolderContextMenu from '../Topbar/Controls/ControlsContextMenu/FolderContextMenu'

enum FolderHeaderActions {
  newDoc = 0,
  newFolder = 1,
}

const FolderPage = () => {
  const { pageFolder, team } = usePage()
  const {
    docsMap,
    foldersMap,
    setCurrentPath,
    workspacesMap,
    currentWorkspaceId,
    createDocHandler,
    createFolderHandler,
  } = useNav()
  const { openModal } = useModal()
  const { openEmojiPicker } = useEmojiPicker()
  const [sending, setSending] = useState<number>()
  const { toggleFolderBookmark, sendingMap, deleteFolder } = useCloudUpdater()
  const { push } = useRouter()
  const [showContextMenu, setShowContextMenu] = useState<boolean>(false)

  const currentFolder = useMemo(() => {
    if (pageFolder == null) {
      return
    }

    return foldersMap.get(pageFolder.id)
  }, [foldersMap, pageFolder])

  const topBarBreadcrumbs = useMemo(() => {
    if (team == null) {
      return []
    }

    return mapTopbarBreadcrumbs(team, foldersMap, workspacesMap, push, {
      pageFolder: currentFolder,
    })
  }, [currentFolder, foldersMap, workspacesMap, push, team])

  const childDocs = useMemo(() => {
    if (currentFolder == null) {
      return []
    }
    return currentFolder.childDocsIds
      .filter((docId) => docsMap.has(docId))
      .map((docId) => docsMap.get(docId) as SerializedDocWithBookmark)
  }, [docsMap, currentFolder])

  const childFolders = useMemo(() => {
    if (currentFolder == null) {
      return []
    }
    return currentFolder.childFoldersIds
      .filter((folderId) => foldersMap.has(folderId))
      .map(
        (folderId) => foldersMap.get(folderId) as SerializedFolderWithBookmark
      )
  }, [foldersMap, currentFolder])

  const pageTitle = useMemo(() => {
    if (currentFolder == null || team == null) {
      return 'BoostHub'
    }

    return `${currentFolder.name} - ${team.name}`
  }, [currentFolder, team])

  useTitle(pageTitle)

  const onEmojiClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      openEmojiPicker(event, {
        item: currentFolder,
        type: 'folder',
      } as EmojiResource)
    },
    [currentFolder, openEmojiPicker]
  )

  useEffect(() => {
    if (currentFolder == null) {
      setCurrentPath('/')
    } else {
      setCurrentPath(currentFolder.pathname)
    }
  }, [currentFolder, setCurrentPath])

  const folderPageControlsKeyDownHandler = useMemo(() => {
    return (event: KeyboardEvent) => {
      if (team == null || pageFolder == null) {
        return
      }

      if (isFolderEditShortcut(event)) {
        preventKeyboardEventPropagation(event)
        openModal(<EditFolderModal folder={pageFolder} />)
        return
      }

      if (isFolderBookmarkShortcut(event)) {
        preventKeyboardEventPropagation(event)
        toggleFolderBookmark(team.id, pageFolder.id, pageFolder.bookmarked)
        return
      }
      if (isFolderDeleteShortcut(event)) {
        preventKeyboardEventPropagation(event)
        deleteFolder(pageFolder)
        return
      }
    }
  }, [openModal, team, pageFolder, deleteFolder, toggleFolderBookmark])
  useGlobalKeyDownHandler(folderPageControlsKeyDownHandler)

  const currentWorkspace = useMemo(() => {
    if (currentWorkspaceId == null) {
      return undefined
    }
    return workspacesMap.get(currentWorkspaceId)
  }, [currentWorkspaceId, workspacesMap])

  const workspaceMap = useMemo(() => {
    const map = new Map<string, SerializedWorkspace>()
    if (currentWorkspace != null) {
      map.set(currentWorkspace.id, currentWorkspace)
    }

    return map
  }, [currentWorkspace])

  const submitNewDoc = useCallback(async () => {
    if (currentFolder == null) {
      return
    }

    try {
      setSending(FolderHeaderActions.newDoc)
      await createDocHandler({
        workspaceId: currentFolder.workspaceId,
        parentFolderId: currentFolder.id,
      })
    } catch (error) {}
    setSending(undefined)
  }, [createDocHandler, currentFolder])

  const submitNewFolder = useCallback(
    async (name: string) => {
      if (name.trim() === '' || currentFolder == null) {
        return
      }

      try {
        setSending(FolderHeaderActions.newFolder)
        await createFolderHandler({
          workspaceId: currentFolder.workspaceId,
          parentFolderId: currentFolder.id,
          folderName: name,
          description: '',
        })
      } catch (error) {}

      setSending(undefined)
    },
    [createFolderHandler, currentFolder]
  )

  const openNewFolderForm = useCallback(() => {
    openModal(
      <SingleInputModal
        content={<p>Name of your new folder</p>}
        onSubmit={submitNewFolder}
      />,
      {
        classNames: 'fit-content',
      }
    )
  }, [openModal, submitNewFolder])

  if (team == null) {
    return (
      <Application
        content={{
          reduced: true,
        }}
      >
        <ErrorLayout message={'Team is missing'} />
      </Application>
    )
  }

  if (currentFolder == null) {
    return (
      <Application
        content={{
          reduced: true,
        }}
      >
        <ErrorLayout message={'The folder has been deleted'} />
      </Application>
    )
  }

  return (
    <Application
      content={{
        reduced: true,
        topbar: {
          breadcrumbs: topBarBreadcrumbs,
          children: (
            <LoadingButton
              variant='icon'
              disabled={sendingMap.has(currentFolder.id)}
              spinning={sendingMap.has(currentFolder.id)}
              size='sm'
              iconPath={currentFolder.bookmarked ? mdiStar : mdiStarOutline}
              onClick={() =>
                toggleFolderBookmark(
                  currentFolder.teamId,
                  currentFolder.id,
                  currentFolder.bookmarked
                )
              }
            />
          ),
          controls: [
            {
              variant: 'icon',
              iconPath: mdiDotsHorizontal,
              onClick: () => setShowContextMenu(true),
            },
          ],
        },
        header: (
          <>
            <EmojiIcon
              defaultIcon={mdiFolderOutline}
              emoji={currentFolder.emoji}
              onClick={onEmojiClick}
              style={{ marginRight: 10 }}
              tooltip='Icon'
              size={20}
            />
            <span
              style={{
                marginRight: 10,
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                overflowX: 'hidden',
              }}
            >
              {currentFolder.name}
            </span>
            <RightLayoutHeaderButtons
              buttons={[
                {
                  disabled: sending != null,
                  sending: sending === FolderHeaderActions.newDoc,
                  tooltip: 'Create new doc',
                  iconPath: mdiTextBoxPlusOutline,
                  onClick: submitNewDoc,
                },
                {
                  disabled: sending != null,
                  sending: sending === FolderHeaderActions.newFolder,
                  tooltip: 'Create new folder',
                  iconPath: mdiFolderMultiplePlusOutline,
                  onClick: openNewFolderForm,
                },
              ]}
            />
          </>
        ),
      }}
    >
      {showContextMenu && (
        <FolderContextMenu
          currentFolder={currentFolder}
          closeContextMenu={() => setShowContextMenu(false)}
        />
      )}
      <ContentManager
        team={team}
        documents={childDocs}
        folders={childFolders}
        workspacesMap={workspaceMap}
      />
    </Application>
  )
}

export default FolderPage
